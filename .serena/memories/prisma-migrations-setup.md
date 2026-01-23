# Prisma Migrations Setup

## Overview

The Vara database uses Prisma ORM with PostgreSQL and pgvector extension for vector similarity search.

## Migration History

### Initial Setup Issue (Fixed 2026-01-14)

**Problem**: The database was originally created using `prisma db push` (direct schema sync) rather than migrations. When incremental migrations were added later, they failed on the shadow database because there was no initial migration creating the base tables.

**Error**: `P3006 - Migration failed to apply cleanly to shadow database. P1014 - The underlying table for model 'protected_images' does not exist`

**Solution**: Created a baseline migration (`20260101000000_initial_schema`) containing the complete schema, then used `prisma migrate resolve --applied` to mark it as already applied (since tables already existed in production).

### Current Migration Structure

```
prisma/migrations/
└── 20260101000000_initial_schema/
    └── migration.sql  # Complete schema with all tables, indexes, and constraints
```

The initial migration includes:
- All tables (users, user_profiles, protected_images, alerts, etc.)
- All enums (RiskLevel, Platform, AlertType, etc.)
- All indexes including composite indexes
- pgvector extension and HNSW indexes
- Face embedding fields and indexes
- All foreign key constraints

## Commands

### Development

```bash
# Check migration status
npx prisma migrate status

# Create new migration
pnpm db:migrate:dev --name <migration_name>

# Reset database (drops all data!)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
pnpm db:studio
```

### Production

```bash
# Apply migrations to production
DATABASE_URL="<production_url>" npx prisma migrate deploy

# Mark a migration as applied (baselining)
npx prisma migrate resolve --applied "<migration_name>"

# Mark a failed migration as rolled back
npx prisma migrate resolve --rolled-back "<migration_name>"
```

## Troubleshooting

### P3006 Shadow Database Error

If you get "Migration failed to apply cleanly to shadow database":

1. Check if there's a missing initial migration
2. Use `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` to generate full schema SQL
3. Create baseline migration with earlier timestamp than existing migrations
4. Use `prisma migrate resolve --applied` to mark as baseline

### P1014 Table Does Not Exist

This usually means migrations are out of sync:
- The migration references a table created by a previous migration that doesn't exist
- Solution: Create or fix the baseline migration

### Database Connection Issues

- Use port `6543` with `?pgbouncer=true` for Supabase pooler
- Use port `5432` for direct connection (needed for migrations)

## Schema Locations

- Schema file: `apps/api/prisma/schema.prisma`
- Migrations: `apps/api/prisma/migrations/`
- Seed file: `apps/api/prisma/seed.ts` (if exists)

## Vector Search (pgvector)

The schema uses pgvector for image and face embeddings:

```prisma
extensions = [vector]

model ProtectedImage {
  embedding     Unsupported("vector(512)")?  // Image CLIP embedding
  faceEmbedding Unsupported("vector(512)")?  // Face ArcFace embedding
}
```

HNSW indexes are created for fast similarity search:
- `protected_images_embedding_idx` - Image similarity
- `protected_images_faceEmbedding_idx` - Face similarity (partial index)

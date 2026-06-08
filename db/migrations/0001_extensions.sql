-- pgvector for semantic search over report narrative. Aurora PostgreSQL 16 ships
-- pgvector 0.8.0 (HNSW + iterative index scans, which help filtered hybrid queries).
CREATE EXTENSION IF NOT EXISTS vector;

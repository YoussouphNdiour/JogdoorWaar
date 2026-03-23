-- Activer l'extension pgvector au démarrage du conteneur PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vérification
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp');

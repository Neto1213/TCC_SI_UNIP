-- Habilite extensões necessárias (opcional se já estiverem ativas)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ajustes na tabela plans
ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS plan_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS learning_type VARCHAR(32) DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS perfil_label VARCHAR(32),
    ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS raw_response JSONB,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Mantemos a coluna data (JSONB) para compatibilidade retroativa.

-- Nova tabela cards
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id INT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    source_id VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    stage_suggestion VARCHAR(64),
    column_key VARCHAR(32) DEFAULT 'novo',
    "order" INT,
    type VARCHAR(32),
    needs_review BOOLEAN DEFAULT FALSE,
    review_after_days INT,
    effort_minutes INT,
    week INT,
    depends_on TEXT[] DEFAULT '{}',
    notes TEXT,
    raw JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_plan_id ON cards(plan_id);
CREATE INDEX IF NOT EXISTS idx_cards_column_key ON cards(column_key);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_cards_source ON cards(source_id);
CREATE INDEX IF NOT EXISTS idx_cards_raw_gin ON cards USING GIN (raw);

-- Tabela opcional para revisão espaçada
CREATE TABLE IF NOT EXISTS card_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    review_at TIMESTAMPTZ,
    status VARCHAR(16) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona coluna para armazenar o nome/username do usuário
ALTER TABLE users
ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Preenche valores existentes com o prefixo do e-mail, se estiver vazio
UPDATE users
SET username = COALESCE(NULLIF(username, ''), split_part(email, '@', 1))
WHERE username IS NULL OR username = '';

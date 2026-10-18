-- Create Users Table
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  message_count INTEGER DEFAULT 0,
  is_subscribed BOOLEAN DEFAULT FALSE,
  welcome_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Messages Table
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Users Table
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_welcome_sent ON users(welcome_sent);
CREATE INDEX idx_users_is_subscribed ON users(is_subscribed);

-- Create Indexes for Messages Table
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at timestamp when a user is updated
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Update existing users to have welcome_sent = false if NULL
UPDATE users SET welcome_sent = FALSE WHERE welcome_sent IS NULL;

-- Add comments to tables and columns for better documentation
COMMENT ON TABLE users IS 'Stores user information and subscription status';
COMMENT ON COLUMN users.user_id IS 'Unique identifier for the user (WhatsApp number)';
COMMENT ON COLUMN users.message_count IS 'Number of messages the user has sent';
COMMENT ON COLUMN users.is_subscribed IS 'Whether the user has an active subscription';
COMMENT ON COLUMN users.welcome_sent IS 'Whether the welcome/privacy message has been sent to the user';

COMMENT ON TABLE messages IS 'Stores conversation history between users and the bot';
COMMENT ON COLUMN messages.user_id IS 'The user participating in the conversation';
COMMENT ON COLUMN messages.role IS 'The role of the message sender (user or assistant)';
COMMENT ON COLUMN messages.content IS 'The actual message content';

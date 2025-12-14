CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL

);

INSERT INTO users (name, email) VALUES 
('Ivan Ivanenko', 'ivan@example.com'),
('Oksana Shevchuk', 'oksana@example.com')

ON DUPLICATE KEY UPDATE name=name; 
-- Test user (admin)
INSERT INTO users (username, password, role) 
VALUES ('admin@example.com', 'admin123', 'admin');

-- Test user (regular)
INSERT INTO users (username, password) 
VALUES ('user@example.com', 'user123');

-- Sample hotels
INSERT INTO hotels (name, location, price, rating, amenities)
VALUES
    ('Grand Plaza', 'New York', 299.99, 4.5, 'Pool, Spa, WiFi'),
    ('Beach Resort', 'Miami', 399.99, 4.8, 'Beachfront, Restaurant, Gym'),
    ('Mountain Lodge', 'Colorado', 199.99, 4.2, 'Skiing, Fireplace');


-- Sample rooms
INSERT INTO rooms (room_number, type, price) VALUES
('101', 'Deluxe', 299.99),
('102', 'Standard', 199.99);
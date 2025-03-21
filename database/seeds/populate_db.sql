INSERT INTO users (name, email, password_hash, role) VALUES
('Ali Khan', 'ali@example.com', 'hashed_password1',  'guest'),
('Sara Ahmed', 'sara@example.com', 'hashed_password2',  'staff'),
('Usman Tariq', 'usman@example.com', 'hashed_password3', 'admin');
INSERT INTO staff (user_id, position, salary, hire_date) VALUES
(2, 'Receptionist', 50000.00, '2023-06-15');
INSERT INTO admins (user_id, access_level) VALUES
(3, 'superadmin');
INSERT INTO rooms (room_number, type, price, status, description) VALUES
('101', 'single', 5000.00, 'available', 'Cozy single room with a nice view.'),
('102', 'double', 8000.00, 'available', 'Spacious double room with modern decor.'),
('201', 'deluxe', 12000.00, 'occupied', 'Luxury deluxe room with sea view.'),
('301', 'suite', 20000.00, 'maintenance', 'High-end suite under renovation.');
INSERT INTO bookings (user_id, room_id, check_in, check_out, status, payment_method, total_price) VALUES
(1, 1, '2025-04-10', '2025-04-15', 'confirmed', 'credit card', 25000.00),
(1, 2, '2025-05-01', '2025-05-05', 'cancelled', 'cash', 32000.00);

INSERT INTO rooms (room_number, type, price, status, description) VALUES
-- Standard Rooms
(103, 'Standard 1', 6000.00, 'available', 'Comfortable standard room with essential amenities.'),
(104, 'Standard 2', 6000.00, 'available', 'A cozy standard room perfect for a short stay.'),
(105, 'Standard 3', 6000.00, 'occupied', 'Spacious standard room with a work desk.'),
(106, 'Standard 4', 6000.00, 'available', 'Well-lit standard room with a relaxing ambiance.'),
(107, 'Standard 5', 6000.00, 'maintenance', 'Standard room currently under maintenance.'),

-- Deluxe Rooms
(202, 'Deluxe 1', 12000.00, 'available', 'Deluxe room with premium bedding and great views.'),
(203, 'Deluxe 2', 12000.00, 'occupied', 'Luxury deluxe room with a private balcony.'),
(204, 'Deluxe 3', 12000.00, 'available', 'Spacious deluxe room with a king-sized bed.'),
(205, 'Deluxe 4', 12000.00, 'maintenance', 'Deluxe room currently being renovated.'),
(206, 'Deluxe 5', 12000.00, 'available', 'Elegant deluxe room with modern interiors.'),

-- Suite Rooms
(302, 'Suite 1', 20000.00, 'available', 'High-end suite with a private lounge and sea view.'),
(303, 'Suite 2', 20000.00, 'occupied', 'Luxury suite with an executive workspace.'),
(304, 'Suite 3', 20000.00, 'available', 'Spacious suite with premium furniture and lighting.'),
(305, 'Suite 4', 20000.00, 'available', 'Suite with a private jacuzzi and rooftop access.'),
(306, 'Suite 5', 20000.00, 'maintenance', 'Suite currently undergoing a luxury upgrade.');
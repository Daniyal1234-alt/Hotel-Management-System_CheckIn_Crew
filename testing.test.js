// __tests__/auth.test.js
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { connect } = require("http2");
const ax = require("axios")
const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('mysql2/promise');
jest.mock('bcryptjs');

// Import the app (assuming you've exported it in your main file)
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "pages")));

describe('Authentication Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /login', () => {
    test('should login a user with valid credentials', async () => {
      // Mock database return values
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: '$2a$10$hashedPassword',
        role: 'guest'
      };
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[mockUser]]),
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        })
      });
      
      bcrypt.compare.mockResolvedValue(true);
      
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.redirectTo).toBe('/index.html');
      expect(response.body.user).toHaveProperty('id', 1);
    });
    
    test('should fail login with invalid email', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[]]),
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });
        
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
    
    test('should fail login with invalid password', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: '$2a$10$hashedPassword',
        role: 'guest'
      };
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[mockUser]]),
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        })
      });
      
      bcrypt.compare.mockResolvedValue(false);
      
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
        
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid password');
    });

    test('should redirect admin to admin dashboard', async () => {
      const mockAdmin = {
        id: 2,
        name: 'Admin User',
        email: 'admin@example.com',
        password_hash: '$2a$10$hashedPassword',
        role: 'admin'
      };
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[mockAdmin]]),
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        })
      });
      
      bcrypt.compare.mockResolvedValue(true);
      
      const response = await request(app)
        .post('/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.redirectTo).toBe('/admin-dashboard.html');
    });
  });
  
  describe('POST /register', () => {
    test('should register a new user with valid data', async () => {
      bcrypt.hash.mockResolvedValue('hashed_password');
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([{ insertId: 3 }]),
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .post('/register')
        .send({
          fullName: 'New User',
          email: 'new@example.com',
          password: 'password123'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.redirectTo).toBe('/pages/login.html');
    });
    
    test('should fail registration with missing fields', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          fullName: 'New User',
          // email missing
          password: 'password123'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('All fields are required');
    });
    
    test('should handle duplicate email error', async () => {
      bcrypt.hash.mockResolvedValue('hashed_password');
      
      const duplicateError = new Error('Duplicate entry');
      duplicateError.code = 'ER_DUP_ENTRY';
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockRejectedValue(duplicateError),
        getConnection: jest.fn().mockResolvedValue({
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .post('/register')
        .send({
          fullName: 'Duplicate User',
          email: 'existing@example.com',
          password: 'password123'
        });
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email already exists');
    });
  });
});

describe('Booking API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /book-room', () => {
    test('should successfully book an available room', async () => {
      const mockPool = {
        getConnection: jest.fn().mockResolvedValue({
          beginTransaction: jest.fn().mockResolvedValue(true),
          execute: jest.fn()
            .mockResolvedValueOnce([[{id: 1}]]) // user query
            .mockResolvedValueOnce([[{id: 101, price: 200}]]) // room query
            .mockResolvedValueOnce([[]]) // check existing bookings
            .mockResolvedValueOnce([{insertId: 201}]) // booking insert
            .mockResolvedValueOnce([{affectedRows: 1}]), // room status update
          commit: jest.fn().mockResolvedValue(true),
          rollback: jest.fn().mockResolvedValue(true),
          release: jest.fn().mockResolvedValue(true)
        })
      };
      
      mysql.createPool.mockReturnValue(mockPool);
      
      const response = await request(app)
        .post('/book-room')
        .send({
          name: 'Test Guest',
          email: 'guest@example.com',
          phone: '1234567890',
          checkIn: '2025-05-01',
          checkOut: '2025-05-05',
          room: 'standard',
          paymentMethod: 'credit_card'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Booking successful!');
      expect(response.body).toHaveProperty('total_price');
      expect(mockPool.getConnection().commit).toHaveBeenCalled();
    });
    
    test('should fail if user is not registered', async () => {
      const mockPool = {
        getConnection: jest.fn().mockResolvedValue({
          beginTransaction: jest.fn().mockResolvedValue(true),
          execute: jest.fn().mockResolvedValueOnce([[]]), // Empty user result
          commit: jest.fn().mockResolvedValue(true),
          rollback: jest.fn().mockResolvedValue(true),
          release: jest.fn().mockResolvedValue(true)
        })
      };
      
      mysql.createPool.mockReturnValue(mockPool);
      
      const response = await request(app)
        .post('/book-room')
        .send({
          name: 'Unknown Guest',
          email: 'unknown@example.com',
          phone: '1234567890',
          checkIn: '2025-05-01',
          checkOut: '2025-05-05',
          room: 'standard',
          paymentMethod: 'credit_card'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account not registered!');
    });
    
    test('should fail if room is not available', async () => {
      const mockPool = {
        getConnection: jest.fn().mockResolvedValue({
          beginTransaction: jest.fn().mockResolvedValue(true),
          execute: jest.fn()
            .mockResolvedValueOnce([[{id: 1}]]) // user query
            .mockResolvedValueOnce([[]]), // Empty room result
          commit: jest.fn().mockResolvedValue(true),
          rollback: jest.fn().mockResolvedValue(true),
          release: jest.fn().mockResolvedValue(true)
        })
      };
      
      mysql.createPool.mockReturnValue(mockPool);
      
      const response = await request(app)
        .post('/book-room')
        .send({
          name: 'Test Guest',
          email: 'guest@example.com',
          phone: '1234567890',
          checkIn: '2025-05-01',
          checkOut: '2025-05-05',
          room: 'presidential', // Non-existent room type
          paymentMethod: 'credit_card'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room not available!');
      expect(mockPool.getConnection().rollback).toHaveBeenCalled();
    });
    
    test('should fail if room is already booked for dates', async () => {
      const mockPool = {
        getConnection: jest.fn().mockResolvedValue({
          beginTransaction: jest.fn().mockResolvedValue(true),
          execute: jest.fn()
            .mockResolvedValueOnce([[{id: 1}]]) // user query
            .mockResolvedValueOnce([[{id: 101, price: 200}]]) // room query
            .mockResolvedValueOnce([[{id: 200}]]), // Existing booking found
          commit: jest.fn().mockResolvedValue(true),
          rollback: jest.fn().mockResolvedValue(true),
          release: jest.fn().mockResolvedValue(true)
        })
      };
      
      mysql.createPool.mockReturnValue(mockPool);
      
      const response = await request(app)
        .post('/book-room')
        .send({
          name: 'Test Guest',
          email: 'guest@example.com',
          phone: '1234567890',
          checkIn: '2025-05-01',
          checkOut: '2025-05-05',
          room: 'standard',
          paymentMethod: 'credit_card'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room already booked for selected dates!');
      expect(mockPool.getConnection().rollback).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/bookings', () => {
    test('should return user bookings when valid userID is provided', async () => {
      const mockBookings = [
        {
          id: 1,
          room: '101',
          checkIn: '2025-05-01',
          checkOut: '2025-05-05',
          status: 'confirmed'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([mockBookings])
      });
      
      const response = await request(app)
        .get('/api/bookings')
        .query({ userID: 1 });
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBookings);
    });
    
    test('should return 400 if userID is missing', async () => {
      const response = await request(app)
        .get('/api/bookings');
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User ID is required');
    });
  });
  
  describe('POST /api/bookings/:id/cancel', () => {
    test('should successfully cancel a confirmed booking', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[{ affectedRows: 1 }]])
      });
      
      const response = await request(app)
        .post('/api/bookings/1/cancel');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Booking cancelled successfully');
    });
    
    test('should fail if booking is not found or already cancelled', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[{ affectedRows: 0 }]])
      });
      
      const response = await request(app)
        .post('/api/bookings/999/cancel');
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Booking not found or already cancelled');
    });
  });
  
  describe('GET /api/bookings/:id', () => {
    test('should return booking details when valid ID is provided', async () => {
      const mockBooking = {
        room_id: 101,
        check_in: '2025-05-01',
        check_out: '2025-05-05'
      };
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[mockBooking]])
      });
      
      const response = await request(app)
        .get('/api/bookings/1');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooking);
    });
    
    test('should return 404 if booking is not found', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[]])
      });
      
      const response = await request(app)
        .get('/api/bookings/999');
        
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Booking not found');
    });
  });
});

describe('Feedback API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/feedback', () => {
    test('should submit feedback for a checked-out booking', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn()
          .mockResolvedValueOnce([[{ user_id: 1 }]]) // booking query
          .mockResolvedValueOnce([{ affectedRows: 1 }]) // feedback insert
      });
      
      const response = await request(app)
        .post('/api/feedback')
        .send({
          bookingId: 1,
          rating: 5,
          comment: 'Great stay!'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Feedback submitted successfully');
    });
    
    test('should fail if booking is not found or not checked out', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValueOnce([[]])
      });
      
      const response = await request(app)
        .post('/api/feedback')
        .send({
          bookingId: 999,
          rating: 5,
          comment: 'Great stay!'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Booking not found or not checked out');
    });
  });
  
  describe('GET /api/feedback/:bookingId', () => {
    test('should return feedback for a specific booking', async () => {
      const mockFeedback = [
        {
          rating: 5,
          comment: 'Great stay!',
          submitted_at: '2025-05-10T12:00:00Z'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([mockFeedback])
      });
      
      const response = await request(app)
        .get('/api/feedback/1');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFeedback);
    });
    
    test('should return 404 if no feedback found', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[]])
      });
      
      const response = await request(app)
        .get('/api/feedback/999');
        
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No feedback found for this booking');
    });
  });
  
  describe('GET /api/feedback/room/:roomId', () => {
    test('should return all feedback for a specific room', async () => {
      const mockFeedback = [
        {
          rating: 5,
          comment: 'Great stay!',
          submitted_at: '2025-05-10T12:00:00Z'
        },
        {
          rating: 4,
          comment: 'Nice room!',
          submitted_at: '2025-05-05T12:00:00Z'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([mockFeedback])
      });
      
      const response = await request(app)
        .get('/api/feedback/room/101');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFeedback);
      expect(response.body.data.length).toBe(2);
    });
  });
});

describe('Rooms API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/rooms', () => {
    test('should return all available rooms', async () => {
      const mockRooms = [
        {
          id: 1,
          room_number: '101',
          type: 'standard',
          price: 100,
          status: 'available',
          description: 'A standard room'
        },
        {
          id: 2,
          room_number: '201',
          type: 'deluxe',
          price: 200,
          status: 'available',
          description: 'A deluxe room'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([mockRooms])
      });
      
      const response = await request(app)
        .get('/api/rooms');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRooms);
      expect(response.body.length).toBe(2);
    });
    
    test('should handle database errors', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      
      const response = await request(app)
        .get('/api/rooms');
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch rooms');
    });
  });
  
  describe('GET /api/all-rooms', () => {
    test('should return all rooms regardless of status', async () => {
      const mockRooms = [
        {
          id: 1,
          room_number: '101',
          type: 'standard',
          status: 'available'
        },
        {
          id: 2,
          room_number: '201',
          type: 'deluxe',
          status: 'occupied'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([mockRooms])
      });
      
      const response = await request(app)
        .get('/api/all-rooms');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRooms);
      expect(response.body.length).toBe(2);
    });
  });
  
  describe('PATCH /api/rooms/:id/status', () => {
    test('should successfully update room status', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[{ affectedRows: 1 }]])
      });
      
      const response = await request(app)
        .patch('/api/rooms/1/status')
        .send({ status: 'available' });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Room status updated');
    });
    
    test('should return 404 if room not found', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[{ affectedRows: 0 }]])
      });
      
      const response = await request(app)
        .patch('/api/rooms/999/status')
        .send({ status: 'available' });
        
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room not found');
    });
    
    test('should return 400 if status is invalid', async () => {
      const response = await request(app)
        .patch('/api/rooms/1/status')
        .send({ status: 'invalid_status' });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid status');
    });
  });
  
  describe('POST /api/create-room', () => {
    test('should create a new room successfully', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn()
          .mockResolvedValueOnce([[]]) // No existing room with same number
          .mockResolvedValueOnce([{ insertId: 3 }]) // Room insert
      });
      
      const response = await request(app)
        .post('/api/create-room')
        .send({
          room_number: '301',
          type: 'suite',
          price: 300,
          description: 'A luxury suite'
        });
        
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe(3);
    });
    
    test('should return 400 if room number already exists', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValueOnce([[{ id: 1 }]]) // Existing room
      });
      
      const response = await request(app)
        .post('/api/create-room')
        .send({
          room_number: '101', // Existing room number
          type: 'suite',
          price: 300,
          description: 'A luxury suite'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room number already exists');
    });
  });
});

describe('Complaints API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/getcomplaintrequest', () => {
    test('should return all unresolved complaints', async () => {
      const mockComplaints = [
        {
          id: 1,
          customer_name: 'Test User',
          check_in: '2025-05-01',
          check_out: '2025-05-05',
          type: 'maintenance',
          message: 'AC not working',
          status: 'pending'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockResolvedValue([mockComplaints]),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .get('/api/getcomplaintrequest');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockComplaints);
    });
    
    test('should handle database errors', async () => {
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockRejectedValue(new Error('Database error')),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .get('/api/getcomplaintrequest');
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error');
    });
  });
  
  describe('PATCH /api/updatecomplaint-request/:id', () => {
    test('should mark complaint as resolved', async () => {
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .patch('/api/updatecomplaint-request/1');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Marked as resolved');
    });
    
    test('should handle database errors', async () => {
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockRejectedValue(new Error('Database error')),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .patch('/api/updatecomplaint-request/1');
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error');
    });
  });
  
  describe('POST /api/complaint-request', () => {
    test('should submit a new complaint', async () => {
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockResolvedValue([{ insertId: 2 }]),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .post('/api/complaint-request')
        .send({
          userId: 1,
          bookingId: 101,
          type: 'maintenance',
          comment: 'TV not working'
        });
        
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Submitted successfully');
      expect(response.body.id).toBe(2);
    });
    
    test('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/complaint-request')
        .send({
          userId: 1,
          // bookingId missing
          type: 'maintenance',
          comment: 'TV not working'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('All fields are required');
    });
    
    test('should handle database errors', async () => {
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockRejectedValue(new Error('Database error')),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .post('/api/complaint-request')
        .send({
          userId: 1,
          bookingId: 101,
          type: 'maintenance',
          comment: 'TV not working'
        });
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error');
    });
  });
  
  describe('GET /api/getUserComplaints/:userId', () => {
    test('should return all complaints for a user', async () => {
      const mockComplaints = [
        {
          id: 1,
          booking_id: 101,
          type: 'maintenance',
          comment: 'AC not working',
          status: 'pending',
          created_at: '2025-05-01T12:00:00Z'
        }
      ];
      
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockResolvedValue([mockComplaints]),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .get('/api/getUserComplaints/1');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockComplaints);
    });
    
    test('should return empty array if no complaints found', async () => {
      mysql.createPool.mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          execute: jest.fn().mockResolvedValue([[]]),
          release: jest.fn()
        })
      });
      
      const response = await request(app)
        .get('/api/getUserComplaints/1');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });
});

describe('User Profile API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock('bcryptjs');
  });
  
  describe('GET /api/user/:id', () => {
    test('should return user profile data', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        created_at: '2024-01-01T00:00:00Z'
      };
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[mockUser]])
      });
      
      const response = await request(app)
        .get('/api/user/1');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
    });
    
    test('should return 404 if user not found', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[]])
      });
      
      const response = await request(app)
        .get('/api/user/999');
        
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });
  
  describe('PATCH /api/user/:id', () => {
    test('should update user profile data', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }])
      });
      
      const response = await request(app)
        .patch('/api/user/1')
        .send({
          name: 'Updated Name',
          phone: '0987654321'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });
    
    test('should return 404 if user not found', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([{ affectedRows: 0 }])
      });
      
      const response = await request(app)
        .patch('/api/user/999')
        .send({
          name: 'Updated Name'
        });
        
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
    
    test('should handle invalid email format', async () => {
      const response = await request(app)
        .patch('/api/user/1')
        .send({
          email: 'invalid-email'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email format');
    });
  });
  
  describe('POST /api/user/change-password', () => {
    test('should successfully change password with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('new_hashed_password');
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn()
          .mockResolvedValueOnce([[{ password_hash: 'current_hashed_password' }]])
          .mockResolvedValueOnce([{ affectedRows: 1 }])
      });
      
      const response = await request(app)
        .post('/api/user/change-password')
        .send({
          userId: 1,
          currentPassword: 'current_password',
          newPassword: 'new_password'
        });
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });
    
    test('should fail with incorrect current password', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockResolvedValue([[{ password_hash: 'current_hashed_password' }]])
      });
      
      const response = await request(app)
        .post('/api/user/change-password')
        .send({
          userId: 1,
          currentPassword: 'wrong_password',
          newPassword: 'new_password'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect');
    });
    
    test('should fail if new password is too short', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .send({
          userId: 1,
          currentPassword: 'current_password',
          newPassword: 'short'
        });
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('New password must be at least 8 characters');
    });
  });
});

describe('Admin Dashboard API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/admin/dashboard/stats', () => {
    test('should return dashboard statistics', async () => {
      const mockStats = {
        totalRooms: 20,
        occupiedRooms: 15,
        availableRooms: 5,
        pendingBookings: 8,
        todayCheckIns: 3,
        todayCheckOuts: 2,
        totalRevenue: 15000
      };
      
      mysql.createPool.mockReturnValue({
        execute: jest.fn()
          .mockResolvedValueOnce([[{ count: 20 }]])  // totalRooms
          .mockResolvedValueOnce([[{ count: 15 }]])  // occupiedRooms
          .mockResolvedValueOnce([[{ count: 5 }]])   // availableRooms
          .mockResolvedValueOnce([[{ count: 8 }]])   // pendingBookings
          .mockResolvedValueOnce([[{ count: 3 }]])   // todayCheckIns
          .mockResolvedValueOnce([[{ count: 2 }]])   // todayCheckOuts
          .mockResolvedValueOnce([[{ total: 15000 }]])  // totalRevenue
      });
      
      const response = await request(app)
        .get('/api/admin/dashboard/stats');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });
    
    test('should handle database errors', async () => {
      mysql.createPool.mockReturnValue({
        execute: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      
      const response = await request(app)
        .get('/api/admin/dashboard/stats');
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error fetching dashboard statistics');
    });
  });
})
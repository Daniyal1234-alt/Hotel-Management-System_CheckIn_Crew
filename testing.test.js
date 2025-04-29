const request = require('supertest');
const { app, pool } = require('./Server.js');

// Mock the MySQL pool
jest.mock('mysql2/promise', () => {
  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn(),
    promise: jest.fn()
  };
  return {
    createPool: jest.fn().mockReturnValue(mockPool)
  };
});

// Mock connection object
const mockConnection = {
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  end: jest.fn()
};

// Mock the pool's getConnection method
pool.getConnection = jest.fn().mockResolvedValue(mockConnection);
pool.execute = jest.fn();
pool.promise = jest.fn().mockReturnValue({
  query: jest.fn(),
  execute: jest.fn()
});

describe('Hotel API Tests', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. BOOK A ROOM TESTS
  describe('Book a Room API', () => {
    test('should successfully book a room with valid data', async () => {
      // Mock user query response
      mockConnection.execute.mockImplementationOnce(() => [
        [{ id: 1 }], // User exists
        []
      ]);

      // Mock room query response
      mockConnection.execute.mockImplementationOnce(() => [
        [{ id: 5, price: 150 }], // Room is available
        []
      ]);

      // Mock booking overlap check
      mockConnection.execute.mockImplementationOnce(() => [
        [], // No overlapping bookings
        []
      ]);

      // Mock insert booking
      mockConnection.execute.mockImplementationOnce(() => [
        { affectedRows: 1 }, // Booking inserted
        []
      ]);

      // Mock update room status
      mockConnection.execute.mockImplementationOnce(() => [
        { affectedRows: 1 }, // Room status updated
        []
      ]);

      const bookingData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        checkIn: '2025-05-01',
        checkOut: '2025-05-05',
        room: 'deluxe',
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/book-room')
        .send(bookingData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking successful!');
      expect(response.body).toHaveProperty('total_price');
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    test('should return error when room is not available', async () => {
      // Mock user query response
      mockConnection.execute.mockImplementationOnce(() => [
        [{ id: 1 }], // User exists
        []
      ]);

      // Mock room query response - empty result means no available room
      mockConnection.execute.mockImplementationOnce(() => [
        [], // No available room
        []
      ]);

      const bookingData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        checkIn: '2025-05-01',
        checkOut: '2025-05-05',
        room: 'deluxe',
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/book-room')
        .send(bookingData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Room not available!');
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });

  // 2. MODIFY AND CANCEL BOOKING TESTS
  describe('Modify and Cancel Booking APIs', () => {
    test('should successfully update a booking', async () => {
      // Mock room price query
      pool.promise.mockReturnValueOnce({
        query: jest.fn().mockResolvedValueOnce([[{ price: 200 }], []]),
      });

      // Mock update booking
      pool.promise.mockReturnValueOnce({
        query: jest.fn().mockResolvedValueOnce([{ affectedRows: 1 }, []]),
      });

      const updateData = {
        room_id: 2,
        check_in: '2025-06-01',
        check_out: '2025-06-05',
        payment_method: 'credit_card'
      };

      const response = await request(app)
        .patch('/api/bookings/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking updated successfully!');
    });

    test('should successfully cancel a booking', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One booking was updated
        []
      ]);

      const response = await request(app)
        .post('/api/bookings/1/cancel');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking cancelled successfully');
    });
  });

  // 3. MANAGE ROOM AVAILABILITY TESTS
  describe('Manage Room Availability API', () => {
    test('should successfully update room status', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One room was updated
        []
      ]);

      const response = await request(app)
        .patch('/api/rooms/1/status')
        .send({ status: 'available' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Room status updated');
    });

    test('should return error for invalid room status', async () => {
      const response = await request(app)
        .patch('/api/rooms/1/status')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Invalid status');
    });
  });

  // 4. MANAGE USER AND STAFF ACCOUNTS TESTS
  describe('User and Staff Management APIs', () => {
    test('should fetch all users successfully', async () => {
      // Mock the user list response
      pool.execute.mockResolvedValueOnce([
        [
          { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2023-01-01', role: 'guest' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-01-02', role: 'staff' }
        ],
        []
      ]);

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('name', 'John Doe');
    });

    test('should successfully update a user', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One user was updated
        []
      ]);

      const updateData = {
        name: 'John Updated',
        email: 'john.updated@example.com'
      };

      const response = await request(app)
        .put('/api/users/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should fetch all staff successfully', async () => {
      // Mock the staff list response
      pool.execute.mockResolvedValueOnce([
        [
          { 
            staff_id: 1, 
            user_id: 2, 
            name: 'Jane Smith', 
            email: 'jane@example.com', 
            position: 'Receptionist', 
            salary: 45000, 
            hire_date: '2023-01-02' 
          }
        ],
        []
      ]);

      const response = await request(app).get('/api/staff');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('position', 'Receptionist');
    });

    test('should successfully add a new staff member', async () => {
      // Mock user insert operation
      pool.execute.mockResolvedValueOnce([
        { insertId: 3 }, // The new user ID
        []
      ]);

      // Mock staff insert operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

      const staffData = {
        name: 'New Staff',
        email: 'newstaff@example.com',
        position: 'Manager',
        salary: 60000,
        hire_date: '2025-04-01'
      };

      const response = await request(app)
        .post('/api/staff')
        .send(staffData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  // 5. AUTHENTICATION TESTS
  describe('Authentication APIs', () => {
    test('should successfully login with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      
      // Mock user query response
      pool.execute.mockResolvedValueOnce([
        [{ 
          id: 1, 
          name: 'John Doe', 
          email: 'john@example.com', 
          password_hash: '$2a$10$somehashedpassword', 
          role: 'guest'
        }],
        []
      ]);

      // Mock the bcrypt compare function
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const loginData = {
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 1);
      expect(response.body.user).toHaveProperty('role', 'guest');
    });

    test('should register a new user successfully', async () => {
      // Mock insert operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1, insertId: 5 },
        []
      ]);

      const registerData = {
        fullName: 'New User',
        email: 'newuser@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/register')
        .send(registerData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('redirectTo', '/pages/login.html');
    });
  });

  // 6. FEEDBACK SYSTEM TESTS
  describe('Feedback System APIs', () => {
    test('should submit feedback successfully', async () => {
      // Mock booking query to check if booking exists
      pool.execute.mockResolvedValueOnce([
        [{ user_id: 1 }], // Booking exists and is checked out
        []
      ]);

      // Mock feedback insertion
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

      const feedbackData = {
        bookingId: 1,
        rating: 5,
        comment: 'Excellent service!'
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Feedback submitted successfully');
    });

    test('should fetch feedback for a booking', async () => {
      // Mock feedback query response
      pool.execute.mockResolvedValueOnce([
        [{ 
          rating: 5, 
          comment: 'Great experience!', 
          submitted_at: '2025-04-10T10:00:00Z' 
        }],
        []
      ]);

      const response = await request(app).get('/api/feedback/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('rating', 5);
    });
  });

  // 7. COMPLAINTS/REQUESTS MANAGEMENT TESTS
  describe('Complaints and Requests Management APIs', () => {
    test('should submit a complaint/request successfully', async () => {
      // Mock insert operation
      mockConnection.execute.mockResolvedValueOnce([
        { affectedRows: 1, insertId: 3 },
        []
      ]);

      const complaintData = {
        userId: 1,
        bookingId: 2,
        type: 'maintenance',
        comment: 'The AC is not working properly.'
      };

      const response = await request(app)
        .post('/api/complaint-request')
        .send(complaintData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Submitted successfully');
      expect(response.body).toHaveProperty('id', 3);
    });

    test('should fetch pending complaints/requests', async () => {
      // Mock complaints query response
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValueOnce([
          [{ 
            id: 1,
            customer_name: 'John Doe',
            check_in: '2025-04-01',
            check_out: '2025-04-05',
            type: 'maintenance',
            message: 'Bathroom sink is leaking',
            status: 'pending'
          }],
          []
        ]),
        release: jest.fn()
      });

      const response = await request(app).get('/api/getcomplaintrequest');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('type', 'maintenance');
    });
  });
});
describe('Hotel API Tests', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. BOOK A ROOM TESTS
  describe('Book a Room API', () => {
    test('should successfully book a room with valid data', async () => {
      // Mock user query response
      mockConnection.execute.mockImplementationOnce(() => [
        [{ id: 1 }], // User exists
        []
      ]);

      // Mock room query response
      mockConnection.execute.mockImplementationOnce(() => [
        [{ id: 5, price: 150 }], // Room is available
        []
      ]);

      // Mock booking overlap check
      mockConnection.execute.mockImplementationOnce(() => [
        [], // No overlapping bookings
        []
      ]);

      // Mock insert booking
      mockConnection.execute.mockImplementationOnce(() => [
        { affectedRows: 1 }, // Booking inserted
        []
      ]);

      // Mock update room status
      mockConnection.execute.mockImplementationOnce(() => [
        { affectedRows: 1 }, // Room status updated
        []
      ]);

      const bookingData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        checkIn: '2025-05-01',
        checkOut: '2025-05-05',
        room: 'deluxe',
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/book-room')
        .send(bookingData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking successful!');
      expect(response.body).toHaveProperty('total_price');
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    test('should return error when room is not available', async () => {
      // Mock user query response
      mockConnection.execute.mockImplementationOnce(() => [
        [{ id: 1 }], // User exists
        []
      ]);

      // Mock room query response - empty result means no available room
      mockConnection.execute.mockImplementationOnce(() => [
        [], // No available room
        []
      ]);

      const bookingData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        checkIn: '2025-05-01',
        checkOut: '2025-05-05',
        room: 'deluxe',
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/book-room')
        .send(bookingData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Room not available!');
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });

  // 2. MODIFY AND CANCEL BOOKING TESTS
  describe('Modify and Cancel Booking APIs', () => {
    test('should successfully update a booking', async () => {
      // Mock room price query
      pool.promise.mockReturnValueOnce({
        query: jest.fn().mockResolvedValueOnce([[{ price: 200 }], []]),
      });

      // Mock update booking
      pool.promise.mockReturnValueOnce({
        query: jest.fn().mockResolvedValueOnce([{ affectedRows: 1 }, []]),
      });

      const updateData = {
        room_id: 2,
        check_in: '2025-06-01',
        check_out: '2025-06-05',
        payment_method: 'credit_card'
      };

      const response = await request(app)
        .patch('/api/bookings/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking updated successfully!');
    });

    test('should successfully cancel a booking', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One booking was updated
        []
      ]);

      const response = await request(app)
        .post('/api/bookings/1/cancel');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking cancelled successfully');
    });
  });

  // 3. MANAGE ROOM AVAILABILITY TESTS
  describe('Manage Room Availability API', () => {
    test('should successfully update room status', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One room was updated
        []
      ]);

      const response = await request(app)
        .patch('/api/rooms/1/status')
        .send({ status: 'available' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Room status updated');
    });

    test('should return error for invalid room status', async () => {
      const response = await request(app)
        .patch('/api/rooms/1/status')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Invalid status');
    });
  });

  // 4. MANAGE USER AND STAFF ACCOUNTS TESTS
  describe('User and Staff Management APIs', () => {
    test('should fetch all users successfully', async () => {
      // Mock the user list response
      pool.execute.mockResolvedValueOnce([
        [
          { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2023-01-01', role: 'guest' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-01-02', role: 'staff' }
        ],
        []
      ]);

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('name', 'John Doe');
    });

    test('should successfully update a user', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One user was updated
        []
      ]);

      const updateData = {
        name: 'John Updated',
        email: 'john.updated@example.com'
      };

      const response = await request(app)
        .put('/api/users/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should fetch all staff successfully', async () => {
      // Mock the staff list response
      pool.execute.mockResolvedValueOnce([
        [
          { 
            staff_id: 1, 
            user_id: 2, 
            name: 'Jane Smith', 
            email: 'jane@example.com', 
            position: 'Receptionist', 
            salary: 45000, 
            hire_date: '2023-01-02' 
          }
        ],
        []
      ]);

      const response = await request(app).get('/api/staff');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('position', 'Receptionist');
    });

    test('should successfully add a new staff member', async () => {
      // Mock user insert operation
      pool.execute.mockResolvedValueOnce([
        { insertId: 3 }, // The new user ID
        []
      ]);

      // Mock staff insert operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

      const staffData = {
        name: 'New Staff',
        email: 'newstaff@example.com',
        position: 'Manager',
        salary: 60000,
        hire_date: '2025-04-01'
      };

      const response = await request(app)
        .post('/api/staff')
        .send(staffData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  // 5. AUTHENTICATION TESTS
  describe('Authentication APIs', () => {
    test('should successfully login with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      
      // Mock user query response
      pool.execute.mockResolvedValueOnce([
        [{ 
          id: 1, 
          name: 'John Doe', 
          email: 'john@example.com', 
          password_hash: '$2a$10$somehashedpassword', 
          role: 'guest'
        }],
        []
      ]);

      // Mock the bcrypt compare function
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const loginData = {
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 1);
      expect(response.body.user).toHaveProperty('role', 'guest');
    });

    test('should register a new user successfully', async () => {
      // Mock insert operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1, insertId: 5 },
        []
      ]);

      const registerData = {
        fullName: 'New User',
        email: 'newuser@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/register')
        .send(registerData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('redirectTo', '/pages/login.html');
    });
  });

  // 6. FEEDBACK SYSTEM TESTS
  describe('Feedback System APIs', () => {
    test('should submit feedback successfully', async () => {
      // Mock booking query to check if booking exists
      pool.execute.mockResolvedValueOnce([
        [{ user_id: 1 }], // Booking exists and is checked out
        []
      ]);

      // Mock feedback insertion
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

      const feedbackData = {
        bookingId: 1,
        rating: 5,
        comment: 'Excellent service!'
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Feedback submitted successfully');
    });

    test('should fetch feedback for a booking', async () => {
      // Mock feedback query response
      pool.execute.mockResolvedValueOnce([
        [{ 
          rating: 5, 
          comment: 'Great experience!', 
          submitted_at: '2025-04-10T10:00:00Z' 
        }],
        []
      ]);

      const response = await request(app).get('/api/feedback/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('rating', 5);
    });
  });

  // 7. COMPLAINTS/REQUESTS MANAGEMENT TESTS
  describe('Complaints and Requests Management APIs', () => {
    test('should submit a complaint/request successfully', async () => {
      // Mock insert operation
      mockConnection.execute.mockResolvedValueOnce([
        { affectedRows: 1, insertId: 3 },
        []
      ]);

      const complaintData = {
        userId: 1,
        bookingId: 2,
        type: 'maintenance',
        comment: 'The AC is not working properly.'
      };

      const response = await request(app)
        .post('/api/complaint-request')
        .send(complaintData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Submitted successfully');
      expect(response.body).toHaveProperty('id', 3);
    });

    test('should fetch pending complaints/requests', async () => {
      // Mock complaints query response
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValueOnce([
          [{ 
            id: 1,
            customer_name: 'John Doe',
            check_in: '2025-04-01',
            check_out: '2025-04-05',
            type: 'maintenance',
            message: 'Bathroom sink is leaking',
            status: 'pending'
          }],
          []
        ]),
        release: jest.fn()
      });

      const response = await request(app).get('/api/getcomplaintrequest');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('type', 'maintenance');
    });
    
    test('should mark a complaint as resolved', async () => {
      // Mock connection
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValueOnce([
          { affectedRows: 1 },
          []
        ]),
        release: jest.fn()
      });

      const response = await request(app)
        .patch('/api/updatecomplaint-request/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Marked as resolved');
    });
  });
  
  // 8. CHECK-IN AND CHECK-OUT TESTS
  describe('Check-in and Check-out APIs', () => {
    test('should successfully check-in a booking', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One booking was updated
        []
      ]);

      const response = await request(app)
        .post('/api/bookings/1/checkin');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking checked in successfully');
    });

    test('should successfully check-out a booking', async () => {
      // Mock update operation result
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 }, // One booking was updated
        []
      ]);

      const response = await request(app)
        .post('/api/bookings/1/checkout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking checked out successfully');
    });
  });
  
  // 9. ROOM MANAGEMENT TESTS
  describe('Room Management APIs', () => {
    test('should fetch all available rooms', async () => {
      // Mock the room list response
      pool.execute.mockResolvedValueOnce([
        [
          { id: 1, room_number: '101', type: 'standard', price: 100, status: 'available', description: 'Standard room' },
          { id: 2, room_number: '201', type: 'deluxe', price: 200, status: 'available', description: 'Deluxe room' }
        ],
        []
      ]);

      const response = await request(app).get('/api/rooms');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('room_number', '101');
      expect(response.body[1]).toHaveProperty('type', 'deluxe');
    });

    test('should add a new room successfully', async () => {
      // Mock check for existing room number
      pool.execute.mockResolvedValueOnce([
        [], // Room number doesn't exist
        []
      ]);

      // Mock insert operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1, insertId: 5 },
        []
      ]);

      const roomData = {
        room_number: '301',
        type: 'suite',
        price: 300,
        description: 'Luxury suite with ocean view'
      };

      const response = await request(app)
        .post('/api/create-room')
        .send(roomData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('id', 5);
    });
    
    test('should update a room successfully', async () => {
      // Mock update operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

      const updateData = {
        type: 'premium',
        price: 250,
        description: 'Updated premium room'
      };

      const response = await request(app)
        .put('/api/update-room/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Room updated successfully');
    });

    test('should delete a room successfully', async () => {
      // Mock delete operation
      pool.execute.mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

      const response = await request(app)
        .delete('/api/remove-room/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Room removed successfully');
    });
  });
  
  // 10. BOOKING HISTORY AND REPORTS TESTS
  describe('Booking History and Reports APIs', () => {
    test('should fetch booking history successfully', async () => {
      // Mock booking history response
      pool.execute.mockResolvedValueOnce([
        [
          { 
            id: 1, 
            customerName: 'John Doe', 
            room: '101', 
            checkIn: '2025-04-01', 
            checkOut: '2025-04-05', 
            status: 'checked-out' 
          },
          { 
            id: 2, 
            customerName: 'Jane Smith', 
            room: '201', 
            checkIn: '2025-04-06', 
            checkOut: '2025-04-08', 
            status: 'confirmed' 
          }
        ],
        []
      ]);

      const response = await request(app).get('/api/booking-history');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('customerName', 'John Doe');
    });

    test('should fetch bookings report successfully', async () => {
      // Mock bookings report response
      pool.execute.mockResolvedValueOnce([
        [
          { 
            id: 1, 
            customerName: 'John Doe', 
            room: '101', 
            checkIn: '2025-04-01', 
            checkOut: '2025-04-05', 
            status: 'checked-out',
            payment_method: 'credit_card',
            total_price: 400,
            booking_date: '2025-03-15'
          }
        ],
        []
      ]);

      const response = await request(app).get('/api/bookings-report');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('payment_method', 'credit_card');
      expect(response.body.data[0]).toHaveProperty('total_price', 400);
    });
  });
  
  // 11. USER BOOKINGS TESTS
  describe('User Bookings APIs', () => {
    test('should fetch user bookings successfully', async () => {
      // Mock user bookings response
      pool.execute.mockResolvedValueOnce([
        [
          { 
            id: 1, 
            room: '101', 
            checkIn: '2025-04-01', 
            checkOut: '2025-04-05', 
            status: 'confirmed',
            hasFeedback: false
          }
        ],
        []
      ]);

      const response = await request(app)
        .post('/api/bookings')
        .send({ userID: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('room', '101');
    });

    test('should fetch user confirmed bookings successfully', async () => {
      // Mock confirmed bookings response
      pool.execute.mockResolvedValueOnce([
        [
          { 
            id: 1, 
            customerName: 'John Doe',
            room: '101', 
            checkIn: '2025-04-01', 
            checkOut: '2025-04-05', 
            status: 'confirmed',
            hasFeedback: false
          }
        ],
        []
      ]);

      const response = await request(app).get('/api/allconfirmedbookings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('status', 'confirmed');
    });
  });
  
  // 12. ROOM DETAILS TESTS
  describe('Room Details APIs', () => {
    test('should fetch room ID by room number', async () => {
      // Mock room query response
      pool.execute.mockResolvedValueOnce([
        [{ id: 5 }],
        []
      ]);

      const response = await request(app).get('/api/roomidbyroomnumber/101');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('room_id', 5);
    });

    test('should fetch room details successfully', async () => {
      // Mock room details response
      pool.execute.mockResolvedValueOnce([
        [{ 
          id: 1, 
          room_number: '101', 
          type: 'standard', 
          price: 100, 
          status: 'available', 
          description: 'Standard room with city view' 
        }],
        []
      ]);

      const response = await request(app).get('/api/room-details/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('room_number', '101');
      expect(response.body).toHaveProperty('type', 'standard');
      expect(response.body).toHaveProperty('price', 100);
    });
  });
  
  // 13. BOOKING DETAILS TESTS
  describe('Booking Details APIs', () => {
    test('should fetch booking details successfully', async () => {
      // Mock MySQL connection and execution
      const mockConnect = {
        execute: jest.fn().mockResolvedValueOnce([
          [{ room_id: 5, check_in: '2025-05-01', check_out: '2025-05-05' }],
          []
        ]),
        end: jest.fn()
      };
      
      const mysql = require('mysql2/promise');
      mysql.createConnection = jest.fn().mockResolvedValueOnce(mockConnect);

      const response = await request(app).get('/api/bookings/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('room_id', 5);
      expect(response.body).toHaveProperty('check_in', '2025-05-01');
      expect(response.body).toHaveProperty('check_out', '2025-05-05');
    });

    test('should return 404 when booking not found', async () => {
      // Mock MySQL connection and execution - empty result
      const mockConnect = {
        execute: jest.fn().mockResolvedValueOnce([
          [], // No booking found
          []
        ]),
        end: jest.fn()
      };
      
      const mysql = require('mysql2/promise');
      mysql.createConnection = jest.fn().mockResolvedValueOnce(mockConnect);

      const response = await request(app).get('/api/bookings/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Booking not found');
    });
  });
  
  // 14. UPDATE BOOKING DETAILS TESTS
  describe('Update Booking Details APIs', () => {
    test('should update booking details successfully', async () => {
      // Mock MySQL connection and execution
      const mockConnect = {
        beginTransaction: jest.fn(),
        execute: jest.fn()
          // First check for overlapping bookings - none found
          .mockResolvedValueOnce([[], []])
          // Then update booking
          .mockResolvedValueOnce([{ affectedRows: 1 }, []]),
        commit: jest.fn(),
        rollback: jest.fn(),
        end: jest.fn()
      };
      
      const mysql = require('mysql2/promise');
      mysql.createConnection = jest.fn().mockResolvedValueOnce(mockConnect);

      const updateData = {
        room_id: 2,
        check_in: '2025-06-01',
        check_out: '2025-06-05'
      };

      const response = await request(app)
        .put('/api/bookings/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Booking updated successfully');
      expect(mockConnect.commit).toHaveBeenCalled();
    });

    test('should return error when room already booked for selected dates', async () => {
      // Mock MySQL connection and execution - overlapping booking
      const mockConnect = {
        beginTransaction: jest.fn(),
        execute: jest.fn()
          // Check for overlapping bookings - found one
          .mockResolvedValueOnce([[{ id: 5 }], []]),
        rollback: jest.fn(),
        end: jest.fn()
      };
      
      const mysql = require('mysql2/promise');
      mysql.createConnection = jest.fn().mockResolvedValueOnce(mockConnect);

      const updateData = {
        room_id: 2,
        check_in: '2025-06-01',
        check_out: '2025-06-05'
      };

      const response = await request(app)
        .put('/api/bookings/1')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Room already booked for selected dates!');
      expect(mockConnect.rollback).toHaveBeenCalled();
    });
  });
});
describe('Staff and Room API Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // === Update Staff ===
  test('PUT /api/staff/:id - successful staff update', async () => {
    pool.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // user update
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // staff update

    const res = await request(app).put('/api/staff/1').send({
      user_id: 1,
      name: 'John',
      email: 'john@example.com',
      position: 'Manager',
      salary: 5000,
      hire_date: '2023-01-01'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // === Delete Staff ===
  test('DELETE /api/staff/:id - successful staff deletion', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ user_id: 10 }]]) // get user_id
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // delete staff
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // delete user

    const res = await request(app).delete('/api/staff/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });


  // === Get Room by ID ===
  test('GET /api/room-details/:id - return room', async () => {
    const room = {
      id: 1,
      room_number: '101',
      type: 'Single',
      price: 1000,
      status: 'available',
      description: 'Nice room'
    };
    pool.execute.mockResolvedValueOnce([[room]]);

    const res = await request(app).get('/api/room-details/1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(room);
  });

  // === Create Room ===
  test('POST /api/create-room - create new room', async () => {
    pool.execute
      .mockResolvedValueOnce([[]]) // no existing room
      .mockResolvedValueOnce([{ insertId: 5 }]); // new room inserted

    const res = await request(app).post('/api/create-room').send({
      room_number: '102',
      type: 'Double',
      price: 1500,
      description: 'Spacious room'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe(5);
  });

  // === Update Room ===
  test('PUT /api/update-room/:id - update room', async () => {
    pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app).put('/api/update-room/1').send({
      type: 'Deluxe',
      price: 2000,
      description: 'Updated description'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});



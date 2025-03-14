# CheckIn Crew
CheckIn Crew is a powerful hotel management software designed to streamline operations, enhance guest experiences, and optimize bookings. With features like reservation management, billing, housekeeping tracking, and real-time reporting, it simplifies hotel administration. Ideal for hotels of all sizes, CheckIn Crew ensures seamless check-ins, efficient staff coordination, and increased revenue.
![Company Logo](https://github.com/user-attachments/assets/c1a6580b-5db3-4a07-a4f1-5731e614969a)

## Database Setup


For Team Members:

They should:

1. npm run setup-db  # Creates database structure
2. npm run seed-db   # (Optional) Adds sample data

explanation of what happens when you run above commands:

1. Install MySQL locally
2. Run initial schema:
```bash
(
mysql -u root -p < database/schema/db_schema.sql

3. Populate DB with starting values:

mysql -u root -p hotel_db < database/seeds/populate_db.sql 
)
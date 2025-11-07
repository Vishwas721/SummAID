"""
Database initialization script for SummAID.
Run this script to create the required tables before running seed.py.
"""
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL must be set in .env file")

def create_tables():
    """Create database tables from schema.sql"""
    try:
        # Read the schema file
        with open('schema.sql', 'r') as f:
            schema_sql = f.read()
        
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("Creating database tables...")
        
        # Execute the schema
        cur.execute(schema_sql)
        conn.commit()
        
        print("✓ Successfully created tables: reports, report_chunks")
        print("✓ Enabled extensions: pgcrypto, vector")
        
        cur.close()
        conn.close()
        
        print("\nDatabase is ready! You can now run seed.py to populate it.")
        
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        raise
    except FileNotFoundError:
        print("Error: schema.sql file not found in current directory")
        print("Make sure you're running this script from the backend directory")
        raise

if __name__ == "__main__":
    create_tables()

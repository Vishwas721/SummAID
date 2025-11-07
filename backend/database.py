"""Database connection utilities for SummAID backend."""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """
    Create and return a new database connection.
    Caller is responsible for closing the connection.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL must be set in .env file")
    
    return psycopg2.connect(DATABASE_URL)

def get_db_cursor(connection, dict_cursor=False):
    """
    Get a cursor from the connection.
    If dict_cursor=True, returns a RealDictCursor for dict-like row access.
    """
    if dict_cursor:
        return connection.cursor(cursor_factory=RealDictCursor)
    return connection.cursor()

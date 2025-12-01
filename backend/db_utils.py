"""
Database Utilities Module
==========================
Handles PostgreSQL connections and data retrieval for SummAID backend.

Functions:
- get_db_connection(): Establish database connection
- get_all_chunks_for_patient(): Retrieve and decrypt patient report chunks
"""

import os
import logging
from typing import List, Dict, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# DATABASE CONNECTION
# =============================================================================

def get_db_connection():
    """
    Establish a connection to the PostgreSQL database.
    
    Uses DATABASE_URL environment variable for connection string.
    
    Returns:
        psycopg2.connection: Active database connection
        
    Raises:
        ValueError: If DATABASE_URL is not set
        psycopg2.Error: If connection fails
    """
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    try:
        conn = psycopg2.connect(database_url)
        logger.debug("Database connection established successfully")
        return conn
    except psycopg2.Error as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


# =============================================================================
# DATA RETRIEVAL FUNCTIONS
# =============================================================================

def get_all_chunks_for_patient(patient_id: int) -> List[Dict[str, str]]:
    """
    Retrieve all decrypted text chunks for a given patient.
    
    This function:
    1. Joins reports and report_chunks tables
    2. Filters by patient_id
    3. Decrypts chunk_text_encrypted using pgp_sym_decrypt
    4. Returns a list of dictionaries with decrypted text
    
    Args:
        patient_id: The ID of the patient to retrieve chunks for
        
    Returns:
        List of dictionaries, each containing {'text': decrypted_chunk_text}
        Returns empty list if no chunks found
        
    Raises:
        ValueError: If ENCRYPTION_KEY is not set
        psycopg2.Error: If database query fails
        
    Example:
        >>> chunks = get_all_chunks_for_patient(1)
        >>> print(chunks[0]['text'])
        'RADIOLOGY REPORT\nPatient: Jane Doe...'
    """
    # Get encryption key from environment
    encryption_key = os.getenv("ENCRYPTION_KEY")
    
    if not encryption_key:
        raise ValueError("ENCRYPTION_KEY environment variable is not set")
    
    # Strip surrounding quotes if present
    encryption_key = encryption_key.strip()
    if len(encryption_key) >= 2 and (
        (encryption_key[0] == '"' and encryption_key[-1] == '"') or 
        (encryption_key[0] == "'" and encryption_key[-1] == "'")
    ):
        encryption_key = encryption_key[1:-1]
    
    conn = None
    try:
        # Establish database connection
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # SQL query to join tables and decrypt chunks
        query = """
            SELECT 
                c.chunk_id,
                c.report_id,
                r.patient_id,
                pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS text,
                c.source_metadata
            FROM report_chunks c
            INNER JOIN reports r ON r.report_id = c.report_id
            WHERE r.patient_id = %s
            ORDER BY r.report_id, c.chunk_id
        """
        
        # Execute query with encryption key and patient_id
        cur.execute(query, (encryption_key, patient_id))
        
        # Fetch all results
        rows = cur.fetchall()
        
        # Convert to list of dictionaries with 'text' key
        chunks = []
        for row in rows:
            if row and row['text']:
                chunks.append({
                    'text': row['text'],
                    'chunk_id': row['chunk_id'],
                    'report_id': row['report_id'],
                    'metadata': row.get('source_metadata')
                })
        
        logger.info(f"Retrieved {len(chunks)} chunks for patient_id={patient_id}")
        
        cur.close()
        return chunks
        
    except psycopg2.Error as e:
        logger.error(f"Database error while retrieving chunks for patient {patient_id}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error while retrieving chunks for patient {patient_id}: {e}")
        raise
    finally:
        if conn:
            conn.close()
            logger.debug("Database connection closed")


def get_patient_info(patient_id: int) -> Optional[Dict[str, any]]:
    """
    Retrieve basic patient information.
    
    Args:
        patient_id: The ID of the patient
        
    Returns:
        Dictionary with patient info or None if not found
        Keys: patient_id, patient_display_name, patient_demo_id, age, sex
        
    Example:
        >>> info = get_patient_info(1)
        >>> print(info['patient_display_name'])
        'Jane Doe'
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                patient_id,
                patient_display_name,
                patient_demo_id,
                age,
                sex,
                chart_prepared_at
            FROM patients
            WHERE patient_id = %s
        """
        
        cur.execute(query, (patient_id,))
        row = cur.fetchone()
        
        cur.close()
        
        if row:
            logger.info(f"Retrieved info for patient_id={patient_id}")
            return dict(row)
        else:
            logger.warning(f"No patient found with patient_id={patient_id}")
            return None
            
    except psycopg2.Error as e:
        logger.error(f"Database error while retrieving patient info: {e}")
        raise
    finally:
        if conn:
            conn.close()


def get_report_types_for_patient(patient_id: int) -> List[str]:
    """
    Get list of report types for a patient.
    
    Useful for determining patient specialty (oncology, speech, etc.)
    
    Args:
        patient_id: The ID of the patient
        
    Returns:
        List of report type strings (e.g., ['Radiology', 'Pathology'])
        
    Example:
        >>> types = get_report_types_for_patient(1)
        >>> print(types)
        ['CT Scan', 'Lab Results', 'Pathology']
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT DISTINCT report_type
            FROM reports
            WHERE patient_id = %s
            ORDER BY report_type
        """
        
        cur.execute(query, (patient_id,))
        rows = cur.fetchall()
        
        cur.close()
        
        report_types = [row[0] for row in rows if row[0]]
        logger.info(f"Found {len(report_types)} report types for patient_id={patient_id}")
        
        return report_types
        
    except psycopg2.Error as e:
        logger.error(f"Database error while retrieving report types: {e}")
        raise
    finally:
        if conn:
            conn.close()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def test_connection() -> bool:
    """
    Test if database connection can be established.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result and result[0] == 1:
            logger.info("Database connection test successful")
            return True
        else:
            logger.error("Database connection test failed: unexpected result")
            return False
            
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


if __name__ == "__main__":
    """
    Test script to verify database utilities work correctly.
    
    Usage: python db_utils.py
    """
    import sys
    
    # Configure logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("=" * 60)
    print("Database Utilities Test")
    print("=" * 60)
    
    # Test 1: Connection
    print("\n1. Testing database connection...")
    if test_connection():
        print("   ✅ Connection successful")
    else:
        print("   ❌ Connection failed")
        sys.exit(1)
    
    # Test 2: Retrieve chunks for patient 1
    print("\n2. Testing chunk retrieval for patient_id=1...")
    try:
        chunks = get_all_chunks_for_patient(1)
        print(f"   ✅ Retrieved {len(chunks)} chunks")
        if chunks:
            first_chunk = chunks[0]['text']
            preview = first_chunk[:100] + "..." if len(first_chunk) > 100 else first_chunk
            print(f"   Preview of first chunk: {preview}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Get patient info
    print("\n3. Testing patient info retrieval for patient_id=1...")
    try:
        info = get_patient_info(1)
        if info:
            print(f"   ✅ Patient: {info.get('patient_display_name', 'N/A')}")
            print(f"      Demo ID: {info.get('patient_demo_id', 'N/A')}")
        else:
            print("   ⚠️ No patient found with ID 1")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Get report types
    print("\n4. Testing report types retrieval for patient_id=1...")
    try:
        types = get_report_types_for_patient(1)
        print(f"   ✅ Report types: {', '.join(types) if types else 'None'}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)

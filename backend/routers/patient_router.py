from fastapi import APIRouter, HTTPException
from typing import List, Dict
from database import get_db_connection

router = APIRouter()

@router.get("/reports/{patient_demo_id}")
def get_reports_for_patient(patient_demo_id: str) -> List[Dict]:
    """
    Return all reports for the given patient_demo_id.
    Each item includes the report_id and the report file path pointer as 'filepath'.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT report_id, report_filepath_pointer
            FROM reports
            WHERE patient_demo_id = %s
            ORDER BY report_id
            """,
            (patient_demo_id,)
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {"report_id": row[0], "filepath": row[1]} for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            conn.close()

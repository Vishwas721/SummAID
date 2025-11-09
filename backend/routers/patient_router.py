from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List, Dict
from database import get_db_connection
import os

router = APIRouter()

@router.get("/reports/{patient_demo_id}")
def get_reports_for_patient(patient_demo_id: str) -> List[Dict]:
    """
    Return all reports for the given patient_demo_id.
    Each item includes the report_id, report_type, and the report file path pointer as 'filepath'.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT r.report_id, r.report_filepath_pointer, r.report_type
            FROM reports r
            JOIN patients p ON p.patient_id = r.patient_id
            WHERE p.patient_demo_id = %s
            ORDER BY r.report_id
            """,
            (patient_demo_id,)
        )
        rows = cur.fetchall()
        cur.close()
        # Add filename for display
        results = []
        for row in rows:
            filepath = row[1]
            filename = os.path.basename(filepath) if filepath else "unknown.pdf"
            results.append({
                "report_id": row[0],
                "filepath": filepath,
                "filename": filename,
                "report_type": row[2] or "General"
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.get("/report-file/{report_id}")
def get_report_file(report_id: int):
    """
    Stream the PDF file for a given report_id.
    Used by the frontend PDF viewer (react-pdf).
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT report_filepath_pointer FROM reports WHERE report_id = %s",
            (report_id,)
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
        filepath = row[0]
        if not os.path.isfile(filepath):
            raise HTTPException(status_code=404, detail=f"File not found: {filepath}")
        return FileResponse(filepath, media_type="application/pdf", filename=os.path.basename(filepath))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error serving file: {str(e)}")
    finally:
        if conn:
            conn.close()

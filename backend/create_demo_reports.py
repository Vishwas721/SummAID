"""
Generate demo PDF reports for testing Summary Cards with graphs.

Creates:
- Jane (5 oncology reports with tumor progression)
- Updates to Rahul's audiogram data
"""

import os
from datetime import datetime, timedelta

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import inch
    from reportlab.lib import colors
except ImportError:
    print("ERROR: reportlab not installed")
    print("Run: pip install reportlab")
    exit(1)


def create_oncology_report(filename, patient_name, date, tumor_size_cm, visit_number):
    """Create a realistic oncology report with explicit tumor measurements."""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1*inch, height - 1*inch, "ONCOLOGY CONSULTATION REPORT")
    
    c.setFont("Helvetica", 10)
    y = height - 1.5*inch
    c.drawString(1*inch, y, f"Patient Name: {patient_name}")
    y -= 0.3*inch
    c.drawString(1*inch, y, f"Date: {date}")
    y -= 0.3*inch
    c.drawString(1*inch, y, f"Visit: {visit_number}")
    y -= 0.3*inch
    c.drawString(1*inch, y, "DOB: 01/15/1962 (62 years old)")
    y -= 0.3*inch
    c.drawString(1*inch, y, "MRN: 123456789")
    
    # Diagnosis section
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "DIAGNOSIS:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, y, "Invasive Ductal Carcinoma, Right Breast")
    y -= 0.2*inch
    c.drawString(1*inch, y, "TNM Staging: T2N0M0")
    y -= 0.2*inch
    c.drawString(1*inch, y, "Grade: 2, Moderately Differentiated")
    
    # Tumor measurement - EXPLICIT FORMAT FOR AI EXTRACTION
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "IMAGING FINDINGS:")
    y -= 0.25*inch
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1*inch, y, f"Tumor size: {tumor_size_cm} cm")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, y, f"Measured on {date} via ultrasound-guided assessment.")
    y -= 0.2*inch
    c.drawString(1*inch, y, f"Primary tumor dimensions: {tumor_size_cm} x {tumor_size_cm * 0.8:.1f} x {tumor_size_cm * 0.6:.1f} cm")
    
    # Biomarkers
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "BIOMARKERS:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, y, "ER: Positive (95%)")
    y -= 0.2*inch
    c.drawString(1*inch, y, "PR: Positive (80%)")
    y -= 0.2*inch
    c.drawString(1*inch, y, "HER2: Negative")
    y -= 0.2*inch
    c.drawString(1*inch, y, "Ki-67: 18%")
    
    # Treatment plan
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "TREATMENT PLAN:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    
    if visit_number == "Initial Consultation":
        c.drawString(1*inch, y, "- Lumpectomy scheduled for next month")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Adjuvant chemotherapy to follow (AC-T regimen)")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Radiation therapy to be considered post-surgery")
    elif "3 Month" in visit_number:
        c.drawString(1*inch, y, "- Post-surgical healing progressing well")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Chemotherapy Cycle 2/6 completed")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Tumor showing good response to treatment")
    elif "6 Month" in visit_number:
        c.drawString(1*inch, y, "- Chemotherapy Cycle 4/6 completed")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Excellent response to treatment observed")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Radiation therapy scheduled to begin next month")
    elif "9 Month" in visit_number:
        c.drawString(1*inch, y, "- Chemotherapy completed (6/6 cycles)")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Radiation therapy in progress (Week 3/6)")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Continued tumor shrinkage noted")
    else:  # 12 month
        c.drawString(1*inch, y, "- All active treatment completed")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Excellent treatment response - near complete remission")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Continue endocrine therapy (Tamoxifen)")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Follow-up imaging in 3 months")
    
    # Footer
    y = 1*inch
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(1*inch, y, "Dr. Sarah Johnson, MD - Medical Oncology")
    y -= 0.15*inch
    c.drawString(1*inch, y, "City General Hospital | Cancer Care Center")
    
    c.save()
    print(f"✓ Created: {filename}")


def create_audiology_report(filename, patient_name, date, visit_number, audiogram_left, audiogram_right):
    """Create audiology report with explicit dB levels at standard frequencies."""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1*inch, height - 1*inch, "CLINICAL AUDIOLOGY REPORT")
    
    c.setFont("Helvetica", 10)
    y = height - 1.5*inch
    c.drawString(1*inch, y, f"Patient Name: {patient_name}")
    y -= 0.3*inch
    c.drawString(1*inch, y, f"Date: {date}")
    y -= 0.3*inch
    c.drawString(1*inch, y, f"Visit: {visit_number}")
    y -= 0.3*inch
    c.drawString(1*inch, y, "DOB: 05/20/1979 (45 years old)")
    y -= 0.3*inch
    c.drawString(1*inch, y, "MRN: 987654321")
    
    # Reason for visit
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "REASON FOR VISIT:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    if "Initial" in visit_number:
        c.drawString(1*inch, y, "Evaluation of hearing sensitivity and speech clarity concerns.")
    elif "6 Month" in visit_number:
        c.drawString(1*inch, y, "Six-month follow-up audiogram to assess hearing aid benefit.")
    else:
        c.drawString(1*inch, y, "Annual audiogram to monitor bilateral sensorineural hearing loss progression.")
    
    # AUDIOGRAM RESULTS - EXPLICIT FORMAT FOR AI EXTRACTION
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "AUDIOGRAM RESULTS:")
    y -= 0.3*inch
    
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1*inch, y, "Left Ear (Air Conduction):")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1.2*inch, y, f"500 Hz: {audiogram_left['500Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"1000 Hz: {audiogram_left['1000Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"2000 Hz: {audiogram_left['2000Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"4000 Hz: {audiogram_left['4000Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"8000 Hz: {audiogram_left['8000Hz']} dB HL")
    
    y -= 0.4*inch
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1*inch, y, "Right Ear (Air Conduction):")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1.2*inch, y, f"500 Hz: {audiogram_right['500Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"1000 Hz: {audiogram_right['1000Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"2000 Hz: {audiogram_right['2000Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"4000 Hz: {audiogram_right['4000Hz']} dB HL")
    y -= 0.2*inch
    c.drawString(1.2*inch, y, f"8000 Hz: {audiogram_right['8000Hz']} dB HL")
    
    # Speech testing
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "SPEECH TESTING:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, y, "SRT (Speech Reception Threshold): 45 dB HL bilaterally")
    y -= 0.2*inch
    c.drawString(1*inch, y, "WRS (Word Recognition Score): 82% at 65 dB HL")
    
    # Clinical impression
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "CLINICAL IMPRESSION:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, y, "Moderate bilateral sensorineural hearing loss")
    y -= 0.2*inch
    c.drawString(1*inch, y, "Tinnitus reported bilaterally")
    y -= 0.2*inch
    c.drawString(1*inch, y, "High-frequency hearing loss pattern consistent with noise exposure")
    
    # Recommendations
    y -= 0.5*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "RECOMMENDATIONS:")
    y -= 0.25*inch
    c.setFont("Helvetica", 10)
    if "Initial" in visit_number:
        c.drawString(1*inch, y, "- Bilateral hearing aids recommended")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Hearing aid orientation scheduled")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Follow-up audiogram in 6 months")
    else:
        c.drawString(1*inch, y, "- Continue hearing aid use")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Annual audiogram monitoring")
        y -= 0.2*inch
        c.drawString(1*inch, y, "- Hearing protection counseling provided")
    
    # Footer
    y = 1*inch
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(1*inch, y, "Dr. Emily Chen, AuD - Clinical Audiologist")
    y -= 0.15*inch
    c.drawString(1*inch, y, "City Medical Center | Audiology & Speech Clinic")
    
    c.save()
    print(f"✓ Created: {filename}")


def main():
    """Generate all demo reports."""
    print("Creating demo PDF reports for SummAID...\n")
    
    # Create directories
    oncology_dir = "demo_reports/oncology"
    speech_dir = "demo_reports/speech_hearing"
    os.makedirs(oncology_dir, exist_ok=True)
    os.makedirs(speech_dir, exist_ok=True)
    
    # Jane's oncology progression (5 reports over 12 months)
    print("Creating Jane's oncology reports...")
    base_date = datetime(2024, 1, 15)
    
    jane_reports = [
        ("Initial Consultation", 0, 3.2),
        ("3 Month Follow-up", 90, 2.8),
        ("6 Month Follow-up", 180, 2.1),
        ("9 Month Follow-up", 270, 1.5),
        ("12 Month Follow-up", 365, 0.9)
    ]
    
    for i, (visit, days_offset, tumor_size) in enumerate(jane_reports, 1):
        date = (base_date + timedelta(days=days_offset)).strftime("%B %d, %Y")
        filename = f"{oncology_dir}/Jane_Report_{i}.pdf"
        create_oncology_report(filename, "Jane Doe", date, tumor_size, visit)
    
    print(f"\n✓ Created 5 oncology reports for Jane")
    
    # Rahul's audiology reports (3 reports)
    print("\nCreating Rahul's audiology reports...")
    base_date = datetime(2024, 2, 10)
    
    rahul_audiograms = [
        # Initial eval - moderate loss
        {
            'visit': 'Initial Evaluation',
            'days': 0,
            'left': {'500Hz': 45, '1000Hz': 50, '2000Hz': 55, '4000Hz': 60, '8000Hz': 65},
            'right': {'500Hz': 40, '1000Hz': 48, '2000Hz': 52, '4000Hz': 58, '8000Hz': 62}
        },
        # 6 month follow-up - slight progression
        {
            'visit': '6 Month Follow-up',
            'days': 180,
            'left': {'500Hz': 45, '1000Hz': 52, '2000Hz': 58, '4000Hz': 63, '8000Hz': 68},
            'right': {'500Hz': 42, '1000Hz': 50, '2000Hz': 55, '4000Hz': 60, '8000Hz': 65}
        },
        # 12 month follow-up - stable with hearing aids
        {
            'visit': '12 Month Follow-up',
            'days': 365,
            'left': {'500Hz': 45, '1000Hz': 52, '2000Hz': 58, '4000Hz': 63, '8000Hz': 68},
            'right': {'500Hz': 42, '1000Hz': 50, '2000Hz': 55, '4000Hz': 60, '8000Hz': 65}
        }
    ]
    
    for i, data in enumerate(rahul_audiograms, 1):
        date = (base_date + timedelta(days=data['days'])).strftime("%B %d, %Y")
        filename = f"{speech_dir}/Rahul_{i}.pdf"
        create_audiology_report(
            filename,
            "Rahul Singh",
            date,
            data['visit'],
            data['left'],
            data['right']
        )
    
    print(f"\n✓ Created 3 audiology reports for Rahul")
    
    print("\n" + "="*60)
    print("✅ All demo reports created successfully!")
    print("="*60)
    print("\nNext steps:")
    print("1. Run: python seed.py")
    print("2. Test summary generation for Jane and Rahul")
    print("3. Verify graphs render correctly:")
    print("   - Jane: Tumor size trend (5 data points)")
    print("   - Rahul: Clinical audiogram (standard frequencies)")


if __name__ == "__main__":
    main()

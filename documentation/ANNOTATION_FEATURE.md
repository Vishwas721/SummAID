# Text Highlighting and Annotation Feature

## Overview
Users can now highlight text in the AI-generated summary and add annotations with contextual notes.

## Features Implemented

### 1. Text Selection Detection
- Uses native browser Selection API to detect when user selects text in summary
- Works seamlessly with mouse drag or keyboard selection

### 2. Floating "+ Note" Button
- Appears automatically when text is selected
- Positioned near the selected text for easy access
- Smooth fade-in animation

### 3. Annotation Modal
- Clean modal dialog for adding notes
- Shows the selected text for context
- Text input for note (e.g., "Check again in 3 months")
- Save/Cancel actions with loading states

### 4. Text Highlighting
- Uses `react-highlight-words` library for robust highlighting
- Previously annotated text is highlighted in yellow
- Highlights persist across sessions

### 5. Backend Integration
- Extended `/annotate` endpoint to accept `selected_text` field
- Database column added: `annotations.selected_text`
- GET `/annotations/{patient_id}` returns all annotations with selected text
- POST `/annotate` saves annotation with selected text and note

## Usage

### For End Users
1. View a patient's AI summary
2. Select any text with your mouse (e.g., "mild hearing loss")
3. Click the floating "+ Note" button
4. Type your note (e.g., "Check again in 3 months")
5. Click "Save Annotation"
6. The selected text will now be highlighted in yellow
7. Highlights persist when viewing the summary again

### Example Workflow (Definition of Done)
✅ Select "mild hearing loss" in summary
✅ Type "Check again in 3 months" 
✅ Save annotation
✅ See text highlighted in yellow
✅ Annotation saved to database with selected_text and note

## Technical Details

### Frontend Changes
- `PatientChartView.jsx`:
  - Added `react-highlight-words` for text highlighting
  - Added text selection handler using Selection API
  - Floating button component with position calculation
  - Annotation modal with form
  - State management for selections, annotations, modal visibility
  - Auto-fetch annotations when summary loads

### Backend Changes
- `main.py`:
  - Updated `AnnotationRequest` model to include `selected_text` field
  - Updated `AnnotationResponse` model to return `selected_text`
  - Modified POST `/annotate` to save `selected_text`
  - Modified GET `/annotations/{patient_id}` to return `selected_text`

### Database Changes
- Migration `002_add_selected_text_to_annotations.sql`:
  - Added `selected_text TEXT` column to `annotations` table
  - Added index on `selected_text` for search performance

## Testing

### Backend API Test
```bash
# Create annotation with selected text
curl -X POST http://localhost:8001/annotate \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 25,
    "doctor_note": "Check again in 3 months",
    "selected_text": "mild hearing loss"
  }'

# Retrieve annotations
curl http://localhost:8001/annotations/25
```

### Expected Response
```json
{
  "annotation_id": 5,
  "patient_id": 25,
  "doctor_note": "Check again in 3 months",
  "selected_text": "mild hearing loss",
  "created_at": "2025-11-22T15:30:00Z"
}
```

## Files Modified
1. `frontend/package.json` - Added react-highlight-words dependency
2. `frontend/src/components/PatientChartView.jsx` - Main implementation
3. `backend/main.py` - API endpoint updates
4. `backend/migrations/002_add_selected_text_to_annotations.sql` - Database migration

## Future Enhancements
- Show annotation notes on hover over highlighted text
- Filter/search annotations by selected text
- Edit/delete annotations
- Color-coded highlights based on annotation type
- Keyboard shortcuts for quick annotation

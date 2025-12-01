# Summary Cards - Modern Grid UI

**Created:** December 1, 2025  
**Purpose:** Replace single text-box summary with independent, loading card components

## Overview

The new card-based UI displays structured patient summaries in a responsive grid layout. Each card loads independently and displays specific data types (evolution, action plan, vitals, specialty data).

## Architecture

### Component Hierarchy

```
SummaryGrid (Container)
├── EvolutionCard (Universal - Medical Journey)
├── ActionPlanCard (Universal - Status & Plan)
├── VitalTrendsCard (Universal - BP/HR Trends)
├── OncologyCard (Conditional - Cancer Data)
└── SpeechCard (Conditional - Audiology Data)
```

### Data Flow

```
Backend /summary/{patient_id}
    ↓ Returns structured JSON
SummaryGrid
    ↓ Parses JSON and passes to cards
Individual Cards
    ↓ Render their specific data
User sees grid of cards
```

## Components

### 1. SummaryGrid.jsx
**Location:** `frontend/src/components/summary/SummaryGrid.jsx`

**Purpose:** Container that fetches and distributes summary data to cards

**Key Features:**
- Fetches summary from `/summary/{patient_id}` endpoint
- Parses JSON response (handles both structured and legacy markdown)
- Distributes data to appropriate cards
- Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
- Loading, error, and empty states

**Props:**
- `patientId` (number): Patient identifier

**Grid Layout:**
```css
grid-cols-1                    /* Mobile: 1 column */
lg:grid-cols-2                 /* Tablet: 2 columns */
xl:grid-cols-3                 /* Desktop: 3 columns */
```

**Card Positioning:**
- EvolutionCard: Spans 2 columns on large screens
- ActionPlanCard: 1 column
- VitalTrendsCard: 1 column
- OncologyCard: Spans 2 columns
- SpeechCard: Spans 2 columns

---

### 2. EvolutionCard.jsx
**Location:** `frontend/src/components/summary/EvolutionCard.jsx`

**Purpose:** Displays patient's medical journey narrative (2-3 sentences)

**Data Source:**
```json
{
  "universal": {
    "evolution": "Patient with chronic hypertension..."
  }
}
```

**Visual Design:**
- Blue gradient header with book icon
- White card with rounded corners
- Citation count footer

**Props:**
- `evolution` (string): Medical journey text
- `citations` (array): Source citations
- `className` (string): Additional CSS classes

---

### 3. ActionPlanCard.jsx
**Location:** `frontend/src/components/summary/ActionPlanCard.jsx`

**Purpose:** Displays current status and treatment plan as checklists

**Data Source:**
```json
{
  "universal": {
    "current_status": [
      "Hypertension controlled on current medications",
      "Recent lab results within normal limits"
    ],
    "plan": [
      "Continue current medications",
      "Follow-up in 3 months",
      "Monitor blood pressure at home"
    ]
  }
}
```

**Visual Design:**
- Green gradient header with clipboard icon
- Two sections: Current Status (amber bullets) and Treatment Plan (green checkmarks)
- Interactive bullet points

**Props:**
- `currentStatus` (array): Status bullet points
- `plan` (array): Action items
- `citations` (array): Source citations
- `className` (string): Additional CSS classes

---

### 4. VitalTrendsCard.jsx
**Location:** `frontend/src/components/summary/VitalTrendsCard.jsx`

**Purpose:** Visualizes blood pressure and heart rate trends

**Data Source:**
```json
{
  "universal": {
    "vital_trends": {
      "blood_pressure": [
        { "date": "2024-01-15", "systolic": 135, "diastolic": 85 },
        { "date": "2024-02-20", "systolic": 128, "diastolic": 82 }
      ],
      "heart_rate": [
        { "date": "2024-01-15", "bpm": 78 },
        { "date": "2024-02-20", "bpm": 72 }
      ]
    }
  }
}
```

**Visual Design:**
- Red gradient header with activity icon
- Latest readings in grid (systolic, diastolic, HR)
- Line chart showing trends over time
- Trend indicators (↑ up, ↓ down, - stable)

**Props:**
- `vitalData` (object): Blood pressure and heart rate data
- `className` (string): Additional CSS classes

**Chart Library:** Recharts (LineChart)

**Conditional Rendering:** Only shows if vital_trends data exists

---

### 5. OncologyCard.jsx
**Location:** `frontend/src/components/summary/OncologyCard.jsx`

**Purpose:** Displays oncology-specific data (tumor size, staging, biomarkers)

**Data Source:**
```json
{
  "oncology": {
    "tumor_size_trend": [
      { "date": "2024-11-15", "size_cm": 2.3 }
    ],
    "tnm_staging": "T2N1M0",
    "cancer_type": "Invasive ductal carcinoma",
    "grade": "Grade 2",
    "biomarkers": {
      "ER": "positive",
      "PR": "positive",
      "HER2": "negative"
    },
    "treatment_response": "Partial response to chemotherapy"
  }
}
```

**Visual Design:**
- Purple gradient header with heart icon
- Cancer type and grade badges
- Tumor size trend chart (line chart)
- Biomarkers grid (ER, PR, HER2, etc.)
- Treatment response section

**Props:**
- `oncologyData` (object): Oncology-specific data
- `citations` (array): Source citations
- `className` (string): Additional CSS classes

**Chart Library:** Recharts (LineChart)

**Conditional Rendering:** Only shows if `oncology` key exists in summary

---

### 6. SpeechCard.jsx
**Location:** `frontend/src/components/summary/SpeechCard.jsx`

**Purpose:** Displays speech/audiology assessment data (audiogram, speech scores)

**Data Source:**
```json
{
  "speech": {
    "audiogram": {
      "left": { "500Hz": 45, "1000Hz": 50, "2000Hz": 55, "4000Hz": 60, "8000Hz": 65 },
      "right": { "500Hz": 40, "1000Hz": 48, "2000Hz": 52, "4000Hz": 58, "8000Hz": 62 }
    },
    "speech_scores": {
      "srt_db": 45,
      "wrs_percent": 82
    },
    "hearing_loss_type": "Sensorineural",
    "hearing_loss_severity": "Moderate",
    "tinnitus": true,
    "amplification": "Bilateral hearing aids"
  }
}
```

**Visual Design:**
- Cyan gradient header with ear icon
- Hearing loss type and severity badges
- Audiogram bar chart (left/right ear frequencies)
- Speech test scores (SRT, WRS)
- Tinnitus indicator
- Amplification recommendation

**Props:**
- `speechData` (object): Speech/audiology data
- `citations` (array): Source citations
- `className` (string): Additional CSS classes

**Chart Library:** Recharts (BarChart)

**Conditional Rendering:** Only shows if `speech` key exists in summary

---

## Integration

### 1. Backend Requirements

The backend must return structured JSON from `/summary/{patient_id}`:

```json
{
  "summary_text": "{\"specialty\":\"oncology\",\"universal\":{...},\"oncology\":{...}}",
  "citations": [...]
}
```

The `summary_text` field contains a JSON string (not markdown) with the following structure:

```json
{
  "specialty": "oncology" | "speech" | "general",
  "universal": {
    "evolution": "string",
    "current_status": ["string"],
    "plan": ["string"],
    "vital_trends": {
      "blood_pressure": [{ "date": "string", "systolic": number, "diastolic": number }],
      "heart_rate": [{ "date": "string", "bpm": number }]
    }
  },
  "oncology": { ... },  // Optional
  "speech": { ... }     // Optional
}
```

### 2. Frontend Integration

**Step 1:** Import SummaryGrid
```jsx
import { SummaryGrid } from './summary/SummaryGrid'
```

**Step 2:** Replace SummaryPanel with SummaryGrid
```jsx
// Old
<SummaryPanel patientId={patientId} />

// New
<SummaryGrid patientId={patientId} />
```

**Step 3:** Ensure dependencies are installed
```bash
npm install recharts
```

### 3. Backward Compatibility

SummaryGrid handles legacy markdown summaries gracefully:

```javascript
if (data.summary_text) {
  try {
    parsedSummary = JSON.parse(data.summary_text)
  } catch (e) {
    // Fallback: treat as plain text
    parsedSummary = { 
      universal: {
        evolution: data.summary_text,
        current_status: [],
        plan: []
      }
    }
  }
}
```

---

## Styling

### Theme Support
All cards support dark mode via Tailwind's `dark:` prefix:

```jsx
className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
```

### Color Schemes
- **EvolutionCard:** Blue (`from-blue-500 to-indigo-600`)
- **ActionPlanCard:** Green (`from-green-500 to-emerald-600`)
- **VitalTrendsCard:** Red (`from-red-500 to-pink-600`)
- **OncologyCard:** Purple (`from-purple-500 to-pink-600`)
- **SpeechCard:** Cyan (`from-cyan-500 to-blue-600`)

### Responsive Breakpoints
- **Mobile (default):** 1 column, cards stack vertically
- **Tablet (lg: 1024px+):** 2 columns
- **Desktop (xl: 1280px+):** 3 columns

### Card Dimensions
- **Min Height:** Auto (content-based)
- **Padding:** 24px (p-6)
- **Border Radius:** 12px (rounded-xl)
- **Shadow:** lg (large drop shadow)
- **Hover:** xl shadow on hover

---

## Testing

### Manual Testing Checklist

1. **Loading State**
   - [ ] Grid shows spinner while fetching data
   - [ ] Spinner is centered and visible

2. **Error State**
   - [ ] Error message displays when API fails
   - [ ] Error is user-friendly and actionable

3. **Empty State**
   - [ ] Message shows when no summary exists
   - [ ] Instructions for MA are clear

4. **Universal Cards (Always Shown)**
   - [ ] EvolutionCard displays narrative text
   - [ ] ActionPlanCard shows status and plan lists
   - [ ] VitalTrendsCard appears only when data exists
   - [ ] Citation counts are accurate

5. **Specialty Cards (Conditional)**
   - [ ] OncologyCard appears for oncology patients
   - [ ] SpeechCard appears for speech patients
   - [ ] Cards hidden when data doesn't exist

6. **Charts**
   - [ ] Vital trends line chart renders correctly
   - [ ] Tumor size trend chart renders correctly
   - [ ] Audiogram bar chart renders correctly
   - [ ] Charts are responsive and readable

7. **Responsive Design**
   - [ ] Mobile: 1 column layout works
   - [ ] Tablet: 2 column layout works
   - [ ] Desktop: 3 column layout works
   - [ ] No horizontal scroll on any screen size

8. **Dark Mode**
   - [ ] All cards render correctly in dark mode
   - [ ] Text is readable (sufficient contrast)
   - [ ] Charts adapt to dark theme

### Test Data

Use the test cases from `backend/test_parallel_prompts.py`:

**Oncology Patient:**
```json
{
  "specialty": "oncology",
  "universal": {
    "evolution": "Jane Doe, a 62-year-old female, was diagnosed with invasive ductal carcinoma...",
    "current_status": ["Breast mass in right upper outer quadrant", "Biopsy confirmed IDC Grade 2"],
    "plan": ["Lumpectomy scheduled", "Adjuvant chemotherapy", "Oncology consult"]
  },
  "oncology": {
    "tumor_size_trend": [{"date": "2024-11-15", "size_cm": 2.3}],
    "cancer_type": "Invasive ductal carcinoma",
    "grade": "Grade 2",
    "biomarkers": {"ER": "positive", "PR": "positive", "HER2": "negative"}
  }
}
```

**Speech Patient:**
```json
{
  "specialty": "speech",
  "universal": {
    "evolution": "John Smith, 45M, presents with moderate bilateral sensorineural hearing loss...",
    "current_status": ["Bilateral hearing loss", "Tinnitus present"],
    "plan": ["Fit bilateral hearing aids", "6-month follow-up"]
  },
  "speech": {
    "audiogram": {
      "left": {"500Hz": 45, "1000Hz": 50, "2000Hz": 55, "4000Hz": 60, "8000Hz": 65},
      "right": {"500Hz": 40, "1000Hz": 48, "2000Hz": 52, "4000Hz": 58, "8000Hz": 62}
    },
    "speech_scores": {"srt_db": 45, "wrs_percent": 82},
    "hearing_loss_severity": "Moderate",
    "tinnitus": true
  }
}
```

---

## Performance

### Loading Strategy
- Cards load independently (no blocking)
- JSON parsing is synchronous (fast)
- Charts lazy-render when data exists

### Optimization
- Use `React.memo` for cards if re-renders are frequent
- Recharts automatically optimizes rendering
- Grid layout uses CSS Grid (hardware-accelerated)

### Bundle Size
- **SummaryGrid:** ~5 KB
- **Cards (total):** ~15 KB
- **Recharts:** ~200 KB (already in bundle)
- **Total New Code:** ~20 KB

---

## Future Enhancements

### Planned Features
1. **Export Card Data:** Download individual card data as PDF/CSV
2. **Card Reordering:** Drag-and-drop to rearrange cards
3. **Card Pinning:** Pin important cards to top
4. **Card Filters:** Filter by specialty, date range, severity
5. **Real-time Updates:** WebSocket-based live card updates
6. **More Specialty Cards:**
   - CardiologyCard (EKG, echo data)
   - RadiologyCard (imaging findings)
   - LabCard (lab result trends)
   - MedicationCard (current meds, interactions)

### Enhancement Proposals
- Add animation when cards appear (fade-in, slide-up)
- Add card collapse/expand functionality
- Add card comparison mode (side-by-side)
- Add card history/timeline view

---

## Troubleshooting

### Cards Not Rendering
**Symptom:** Grid shows but cards are empty  
**Cause:** JSON structure mismatch  
**Fix:** Verify backend returns correct JSON schema

### Charts Not Displaying
**Symptom:** Card shows but chart is blank  
**Cause:** Recharts not installed or data format incorrect  
**Fix:** 
```bash
npm install recharts
```
Check data format matches expected structure

### Dark Mode Issues
**Symptom:** Cards unreadable in dark mode  
**Fix:** Ensure all text uses `dark:text-*` classes

### Layout Breaking on Mobile
**Symptom:** Horizontal scroll or overlapping cards  
**Fix:** Check grid classes use responsive prefixes (`lg:`, `xl:`)

---

## Files Created

```
frontend/src/components/summary/
├── SummaryGrid.jsx       (Grid container, ~150 lines)
├── EvolutionCard.jsx     (Medical journey, ~50 lines)
├── ActionPlanCard.jsx    (Status & plan, ~80 lines)
├── VitalTrendsCard.jsx   (BP/HR trends, ~150 lines)
├── OncologyCard.jsx      (Cancer data, ~180 lines)
└── SpeechCard.jsx        (Audiology data, ~180 lines)

Total: ~790 lines of new code
```

## Modified Files

```
frontend/src/components/ToolsSidebar.jsx
- Added: import { SummaryGrid } from './summary/SummaryGrid'
- Changed: <SummaryPanel /> → <SummaryGrid />
```

---

## Summary

✅ **Modern card-based UI** replaces single text box  
✅ **Independent loading** for each data type  
✅ **Responsive grid layout** (mobile → tablet → desktop)  
✅ **Rich visualizations** with Recharts (BP trends, tumor size, audiogram)  
✅ **Specialty-aware** (oncology, speech, general)  
✅ **Dark mode support** throughout  
✅ **Backward compatible** with legacy markdown summaries  

**Next Steps:**
1. Test with real patient data
2. Monitor card rendering performance
3. Gather user feedback
4. Iterate on card designs based on usage

---

**Documentation Version:** 1.0  
**Last Updated:** December 1, 2025  
**Author:** GitHub Copilot

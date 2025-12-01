import React from 'react';
import { 
  FileText, 
  FlaskConical, 
  Scan, 
  Activity, 
  Stethoscope,
  FileSearch,
  Ear,
  MessageSquare
} from 'lucide-react';

/**
 * PatientTimeline - Visual timeline of patient's medical reports
 * Shows chronological journey with report types and icons
 */
export const PatientTimeline = ({ reports, className = '' }) => {
  if (!reports || reports.length === 0) {
    return null;
  }

  // Map report types to icons and colors
  const getReportStyle = (reportType) => {
    const type = reportType?.toLowerCase() || '';
    
    if (type.includes('oncology') || type.includes('cancer')) {
      return { 
        icon: FlaskConical, 
        color: 'bg-purple-500 dark:bg-purple-600',
        textColor: 'text-purple-700 dark:text-purple-300',
        bgLight: 'bg-purple-50 dark:bg-purple-900/20'
      };
    }
    if (type.includes('speech') || type.includes('audiology') || type.includes('hearing')) {
      return { 
        icon: Ear, 
        color: 'bg-cyan-500 dark:bg-cyan-600',
        textColor: 'text-cyan-700 dark:text-cyan-300',
        bgLight: 'bg-cyan-50 dark:bg-cyan-900/20'
      };
    }
    if (type.includes('radiology') || type.includes('imaging') || type.includes('mri') || type.includes('ct')) {
      return { 
        icon: Scan, 
        color: 'bg-blue-500 dark:bg-blue-600',
        textColor: 'text-blue-700 dark:text-blue-300',
        bgLight: 'bg-blue-50 dark:bg-blue-900/20'
      };
    }
    if (type.includes('pathology') || type.includes('biopsy')) {
      return { 
        icon: FlaskConical, 
        color: 'bg-pink-500 dark:bg-pink-600',
        textColor: 'text-pink-700 dark:text-pink-300',
        bgLight: 'bg-pink-50 dark:bg-pink-900/20'
      };
    }
    if (type.includes('lab') || type.includes('blood')) {
      return { 
        icon: Activity, 
        color: 'bg-red-500 dark:bg-red-600',
        textColor: 'text-red-700 dark:text-red-300',
        bgLight: 'bg-red-50 dark:bg-red-900/20'
      };
    }
    if (type.includes('clinical') || type.includes('consult')) {
      return { 
        icon: Stethoscope, 
        color: 'bg-green-500 dark:bg-green-600',
        textColor: 'text-green-700 dark:text-green-300',
        bgLight: 'bg-green-50 dark:bg-green-900/20'
      };
    }
    
    // Default
    return { 
      icon: FileText, 
      color: 'bg-slate-500 dark:bg-slate-600',
      textColor: 'text-slate-700 dark:text-slate-300',
      bgLight: 'bg-slate-50 dark:bg-slate-900/20'
    };
  };

  // Extract date from filename or use report_id as fallback ordering
  const extractDateFromFilename = (filename) => {
    // Try to extract date patterns like:
    // Jane_Report_1.pdf -> assume sequential
    // Report_2024_01_15.pdf -> extract date
    // No reliable date info, return null
    return null;
  };

  // Sort reports by report_id (chronological order assumed)
  const sortedReports = [...reports].sort((a, b) => a.report_id - b.report_id);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-white" />
          <h2 className="text-lg font-semibold text-white">Patient Journey Timeline</h2>
          <span className="ml-auto text-sm text-white/80">{sortedReports.length} Reports</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-purple-200 to-slate-200 dark:from-indigo-800 dark:via-purple-800 dark:to-slate-700" 
               style={{ top: '24px', bottom: '24px' }}></div>

          {/* Timeline items */}
          <div className="space-y-4">
            {sortedReports.map((report, index) => {
              const style = getReportStyle(report.report_type);
              const Icon = style.icon;
              const isFirst = index === 0;
              const isLast = index === sortedReports.length - 1;

              return (
                <div key={report.report_id} className="relative flex items-start gap-4 group">
                  {/* Timeline node */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full ${style.color} flex items-center justify-center shadow-md ring-4 ring-white dark:ring-slate-800 transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Report card */}
                  <div className={`flex-1 min-w-0 ${style.bgLight} rounded-lg p-4 border border-slate-200 dark:border-slate-700 transition-all group-hover:shadow-md group-hover:border-slate-300 dark:group-hover:border-slate-600`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold ${style.textColor} truncate`}>
                          {report.report_type || 'Medical Report'}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 truncate" title={report.filename}>
                          {report.filename}
                        </p>
                        {isFirst && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                            Initial Report
                          </span>
                        )}
                        {isLast && sortedReports.length > 1 && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                            Latest Report
                          </span>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600">
                          Report #{report.report_id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>Medical records spanning {sortedReports.length} report{sortedReports.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Show unique report types */}
              {[...new Set(sortedReports.map(r => r.report_type))].map((type, i) => {
                const style = getReportStyle(type);
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${style.color}`}></div>
                    <span className="text-xs">{type || 'General'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

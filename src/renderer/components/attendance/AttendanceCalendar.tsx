import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ClockIcon,
  QuestionMarkCircledIcon,
  SunIcon
} from '@radix-ui/react-icons';

interface AttendanceRecord {
  id: number;
  subscriber_id: number;
  subscriber_name: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'holiday';
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

interface AttendanceCalendarProps {
  onDateSelect?: (date: string) => void;
  onMarkAttendance?: (date: string) => void;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ 
  onDateSelect,
  onMarkAttendance
}) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord[]>>({});
  const [loading, setLoading] = useState(false);

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Generate days array
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null); // Empty days for padding
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentYear, currentMonth, i);
    days.push(date);
  }

  // Month names
  const monthNames = [
    t('attendance.months.january'),
    t('attendance.months.february'),
    t('attendance.months.march'),
    t('attendance.months.april'),
    t('attendance.months.may'),
    t('attendance.months.june'),
    t('attendance.months.july'),
    t('attendance.months.august'),
    t('attendance.months.september'),
    t('attendance.months.october'),
    t('attendance.months.november'),
    t('attendance.months.december')
  ];

  // Day names
  const dayNames = [
    t('attendance.days.sun'),
    t('attendance.days.mon'),
    t('attendance.days.tue'),
    t('attendance.days.wed'),
    t('attendance.days.thu'),
    t('attendance.days.fri'),
    t('attendance.days.sat')
  ];

  useEffect(() => {
    loadAttendanceForMonth();
  }, [currentMonth, currentYear]);

  const loadAttendanceForMonth = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      const result = await window.electronAPI.database.query(`
        SELECT a.*, s.name as subscriber_name 
        FROM attendance a
        LEFT JOIN subscribers s ON a.subscriber_id = s.id
        WHERE a.date BETWEEN ? AND ?
        ORDER BY a.date DESC
      `, [startDate, endDate]);

      if (result.success && result.data) {
        const groupedData: Record<string, AttendanceRecord[]> = {};
        result.data.forEach((record: AttendanceRecord) => {
          if (!groupedData[record.date]) {
            groupedData[record.date] = [];
          }
          groupedData[record.date].push(record);
        });
        setAttendanceData(groupedData);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    setSelectedDate(dateString);
    if (onDateSelect) {
      onDateSelect(dateString);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    if (onDateSelect) {
      onDateSelect(today);
    }
  };

  const getDateStats = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const records = attendanceData[dateString] || [];
    
    const stats = {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      excused: records.filter(r => r.status === 'excused').length,
      total: records.length
    };

    return stats;
  };

  const getStatusColor = (date: Date) => {
    const stats = getDateStats(date);
    if (stats.total === 0) return 'bg-gray-50';
    
    const presentPercentage = (stats.present / stats.total) * 100;
    
    if (presentPercentage >= 90) return 'bg-green-50 border-green-200';
    if (presentPercentage >= 70) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getStatusIcon = (date: Date) => {
    const stats = getDateStats(date);
    if (stats.total === 0) return null;
    
    if (stats.absent === 0 && stats.late === 0) {
      return <CheckCircledIcon className="w-4 h-4 text-green-600" />;
    } else if (stats.absent > stats.present / 2) {
      return <CrossCircledIcon className="w-4 h-4 text-red-600" />;
    } else if (stats.late > 0) {
      return <ClockIcon className="w-4 h-4 text-yellow-600" />;
    }
    
    return <QuestionMarkCircledIcon className="w-4 h-4 text-gray-600" />;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    const dateString = date.toISOString().split('T')[0];
    return dateString === selectedDate;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Calendar Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePreviousMonth}
              className="p-2 rounded-lg hover:bg-gray-100"
              title={t('attendance.previousMonth')}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <p className="text-gray-600">{t('attendance.calendar')}</p>
            </div>
            
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-gray-100"
              title={t('attendance.nextMonth')}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <SunIcon className="w-4 h-4" />
              <span>{t('attendance.today')}</span>
            </button>
            
            {onMarkAttendance && (
              <button
                onClick={() => onMarkAttendance(selectedDate || new Date().toISOString().split('T')[0])}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <CheckCircledIcon className="w-4 h-4" />
                <span>{t('attendance.mark')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-gray-700">{t('attendance.goodAttendance')} (≥90%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-gray-700">{t('attendance.averageAttendance')} (70-89%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-gray-700">{t('attendance.poorAttendance')} (&lt;70%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span className="text-gray-700">{t('attendance.noData')}</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map((day) => (
            <div key={day} className="text-center font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">{t('common.loading')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {days.map((date, index) => (
              <div
                key={index}
                className={`min-h-32 border rounded-lg p-2 transition-all ${
                  date ? 'cursor-pointer hover:shadow-md' : ''
                } ${
                  date && isToday(date) ? 'border-blue-300 bg-blue-50' : ''
                } ${
                  date && isSelected(date) ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-200' : ''
                } ${
                  date ? getStatusColor(date) : ''
                }`}
                onClick={() => date && handleDateClick(date)}
              >
                {date && (
                  <>
                    {/* Date Header */}
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-semibold ${
                        isToday(date) ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </span>
                      {getStatusIcon(date)}
                    </div>

                    {/* Attendance Stats */}
                    {getDateStats(date).total > 0 && (
                      <div className="space-y-1 mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-600 font-medium">
                            {getDateStats(date).present} {t('attendance.presentShort')}
                          </span>
                          {getDateStats(date).late > 0 && (
                            <span className="text-yellow-600">
                              {getDateStats(date).late} {t('attendance.lateShort')}
                            </span>
                          )}
                        </div>
                        {(getDateStats(date).absent > 0 || getDateStats(date).excused > 0) && (
                          <div className="flex items-center justify-between text-xs">
                            {getDateStats(date).absent > 0 && (
                              <span className="text-red-600">
                                {getDateStats(date).absent} {t('attendance.absentShort')}
                              </span>
                            )}
                            {getDateStats(date).excused > 0 && (
                              <span className="text-purple-600">
                                {getDateStats(date).excused} {t('attendance.excusedShort')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* No Data Indicator */}
                    {getDateStats(date).total === 0 && !isToday(date) && (
                      <div className="text-center mt-4">
                        <CalendarIcon className="w-5 h-5 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-500 mt-1 block">
                          {t('attendance.noRecords')}
                        </span>
                      </div>
                    )}

                    {/* Today's Marker */}
                    {isToday(date) && getDateStats(date).total === 0 && (
                      <div className="text-center mt-4">
                        <span className="text-xs text-blue-600 font-medium">
                          {t('attendance.today')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Selected Date Info */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {formatDate(new Date(selectedDate))}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {attendanceData[selectedDate]?.length || 0} {t('attendance.records')}
                </p>
              </div>
              <button
                onClick={() => onMarkAttendance?.(selectedDate)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                {t('attendance.viewDetails')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
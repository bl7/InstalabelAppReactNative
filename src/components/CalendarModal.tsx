import React, {useMemo, useState} from 'react';
import {Modal, View, Text, StyleSheet, TouchableOpacity} from 'react-native';

interface CalendarModalProps {
  visible: boolean;
  initialDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSelect: (yyyyMmDd: string) => void;
  onClear?: () => void;
  title?: string;
}

const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseYyyyMmDd(value?: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date();
  }
  const [y, m, d] = value.split('-').map(n => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return new Date();
  return dt;
}

function toYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  initialDate,
  onClose,
  onSelect,
  onClear,
  title = 'Select Date',
}) => {
  const parsed = useMemo(() => parseYyyyMmDd(initialDate), [initialDate]);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(parsed.getFullYear(), parsed.getMonth(), 1),
  );

  const today = useMemo(() => startOfDay(new Date()), []);

  const daysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const startWeekday = firstDayOfMonth.getDay(); // 0-6
    const daysInMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    ).getDate();

    const cells: {date: Date | null; key: string}[] = [];

    // Leading blanks
    for (let i = 0; i < startWeekday; i++) {
      cells.push({date: null, key: `blank-${i}`});
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        d,
      );
      cells.push({date: dt, key: `day-${d}`});
    }

    // Ensure rows are complete (multiples of 7)
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({date: null, key: `trail-${i}`});
      }
    }

    return cells;
  }, [currentMonth]);

  const isSameYmd = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonth]);

  const goPrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };
  const goNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.navButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={goPrevMonth}
              accessibilityRole="button"
              accessibilityLabel="Previous month">
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity
              style={styles.navButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={goNextMonth}
              accessibilityRole="button"
              accessibilityLabel="Next month">
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {daysOfWeek.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {daysGrid.map(cell => {
              if (!cell.date) {
                return <View key={cell.key} style={styles.cellEmpty} />;
              }
              const isToday = isSameYmd(cell.date, today);
              const label = String(cell.date.getDate());
              const disabled =
                startOfDay(cell.date).getTime() < today.getTime();
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.cell,
                    isToday && styles.todayCell,
                    disabled && styles.disabledCell,
                  ]}
                  disabled={disabled}
                  hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}
                  onPress={() => cell.date && onSelect(toYyyyMmDd(cell.date))}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${label}`}>
                  <Text
                    style={[
                      styles.cellText,
                      isToday && styles.todayCellText,
                      disabled && styles.disabledCellText,
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            {onClear ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.clearBtn]}
                onPress={onClear}
                accessibilityRole="button"
                accessibilityLabel="Clear date">
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.actionBtn, styles.todayBtn]}
              onPress={() => onSelect(toYyyyMmDd(today))}
              accessibilityRole="button"
              accessibilityLabel="Select today">
              <Text style={styles.todayText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '88%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A2BE2',
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navButtonText: {
    fontSize: 20,
    color: '#8A2BE2',
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  disabledCell: {
    opacity: 0.35,
  },
  cellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  cellText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  disabledCellText: {
    color: '#999',
  },
  todayCell: {
    backgroundColor: '#f3e8ff',
  },
  todayCellText: {
    color: '#7c3aed',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearBtn: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  clearText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  todayBtn: {
    backgroundColor: '#e9d5ff',
  },
  todayText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  cancelText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
});

export default CalendarModal;

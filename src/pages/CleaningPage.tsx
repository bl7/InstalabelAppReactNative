import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {apiService, CleaningOccurrence} from '../services/api';
import {useAuth} from '../contexts/AuthContext';
import NetInfo from '@react-native-community/netinfo';

const FREQUENCY_ORDER = ['daily', 'weekly', 'monthly'];

const frequencyLabel = (frequency: string) => {
  if (frequency === 'daily') return 'Daily';
  if (frequency === 'weekly') return 'Weekly';
  if (frequency === 'monthly') return 'Monthly';
  return frequency ? frequency.charAt(0).toUpperCase() + frequency.slice(1) : 'Other';
};

const attachFrequency = (
  tasks: CleaningOccurrence[],
  byId: Record<string, {frequency: string; scheduleLabel: string}>,
) =>
  tasks.map(task => ({
    ...task,
    frequency: byId[task.taskId]?.frequency || task.frequency || '',
    scheduleLabel: byId[task.taskId]?.scheduleLabel || task.scheduleLabel || '',
  }));

const groupByArea = (tasks: CleaningOccurrence[]) => {
  const areas = Array.from(new Set(tasks.map(task => task.areaName || 'Other'))).sort();
  return areas.map(area => ({
    area,
    tasks: tasks.filter(task => (task.areaName || 'Other') === area),
  }));
};

const CleaningPage: React.FC = () => {
  const {isAuthenticated} = useAuth();
  const [todayLabel, setTodayLabel] = useState('');
  const [today, setToday] = useState<CleaningOccurrence[]>([]);
  const [overdue, setOverdue] = useState<CleaningOccurrence[]>([]);
  const [upcoming, setUpcoming] = useState<CleaningOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState('daily');
  const [staff, setStaff] = useState<string[]>([]);
  const [staffName, setStaffName] = useState('');
  const [showStaff, setShowStaff] = useState(false);
  const [pendingTask, setPendingTask] = useState<CleaningOccurrence | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [todayRes, overdueRes, upcomingRes, taskRes, staffRes] = await Promise.all([
        apiService.getCleaningOccurrences('today'),
        apiService.getCleaningOccurrences('overdue'),
        apiService.getCleaningOccurrences('upcoming'),
        apiService.getCleaningTasks(),
        apiService.getLabelInitials().catch(() => ({use_initials: false, initials: [] as string[]})),
      ]);
      const people = (staffRes.staff || [])
        .map(person => person.name || person.initial)
        .filter(Boolean);
      setStaff(people.length ? people : staffRes.initials || []);
      const byId = Object.fromEntries(
        (taskRes.data || []).map(task => [
          task.uuid,
          {frequency: task.frequency, scheduleLabel: task.scheduleLabel},
        ]),
      );
      setTodayLabel(todayRes.data.todayLabel);
      setToday(attachFrequency(todayRes.data.tasks || [], byId));
      setOverdue(attachFrequency(overdueRes.data.tasks || [], byId));
      setUpcoming(attachFrequency(upcomingRes.data.tasks || [], byId));
    } catch (err: any) {
      setError(err?.message || 'Could not load cleaning tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      load();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, load]);

  const complete = async (task: CleaningOccurrence, name = staffName) => {
    if (task.status === 'completed' || busyId) return;
    if (!name) {
      setPendingTask(task);
      setShowStaff(true);
      return;
    }
    const network = await NetInfo.fetch();
    if (!network.isConnected) {
      setError('No network connection. This task was not completed.');
      return;
    }
    setBusyId(task.uuid);
    setError('');
    try {
      const response = await apiService.completeCleaningOccurrence(task.uuid, name);
      const finished = {
        ...response.data,
        taskId: task.taskId,
        frequency: task.frequency,
        scheduleLabel: task.scheduleLabel,
      };
      setToday(current => current.map(item => (item.uuid === task.uuid ? finished : item)));
      setOverdue(current => current.map(item => (item.uuid === task.uuid ? finished : item)));
    } catch (err: any) {
      setError(err?.message || 'Could not complete this task.');
    } finally {
      setBusyId(null);
    }
  };

  const extraFrequencies = Array.from(
    new Set([...today, ...overdue, ...upcoming].map(task => task.frequency || '').filter(Boolean)),
  ).filter(key => !FREQUENCY_ORDER.includes(key));
  const tabs = [...FREQUENCY_ORDER, ...extraFrequencies];
  const inTab = (tasks: CleaningOccurrence[]) =>
    tasks.filter(task => (task.frequency || '') === frequency);
  const earlierOverdue = inTab(overdue).filter(task => !today.some(item => item.uuid === task.uuid));
  const todayInTab = inTab(today);
  const upcomingInTab = inTab(upcoming);
  const upcomingDates = Array.from(new Set(upcomingInTab.map(task => task.scheduledDate))).sort();
  const tabIsEmpty = earlierOverdue.length === 0 && todayInTab.length === 0 && upcomingInTab.length === 0;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <Text style={styles.empty}>Please log in to see cleaning tasks.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#8A2BE2" />
      ) : (
        <View style={styles.body}>
        <View style={styles.tabNavigation}>
          {tabs.map(key => {
            const active = frequency === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active ? styles.activeTab : styles.inactiveTab]}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                accessibilityRole="tab"
                accessibilityLabel={`${frequencyLabel(key)} tab`}
                onPress={() => setFrequency(key)}>
                <Text style={[styles.tabText, active && styles.activeTabText]}>
                  {frequencyLabel(key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }>
          <TouchableOpacity style={styles.staffRow} onPress={() => setShowStaff(true)}>
            <Text style={styles.staffLabel}>Completed by</Text>
            <Text style={styles.staffValue}>{staffName || 'Select staff'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionLabel}>Today</Text>
          <Text style={styles.date}>{todayLabel}</Text>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={load}>
                <Text style={styles.retry}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {tabIsEmpty ? (
            <Text style={styles.empty}>Nothing in {frequencyLabel(frequency)}.</Text>
          ) : null}
          {earlierOverdue.length > 0 ? (
            <View>
              <Text style={styles.frequency}>Overdue</Text>
              <AreaList tasks={earlierOverdue} busyId={busyId} onComplete={complete} showDate />
            </View>
          ) : null}
          {todayInTab.length > 0 ? (
            <AreaList tasks={todayInTab} busyId={busyId} onComplete={complete} />
          ) : !tabIsEmpty ? (
            <Text style={styles.empty}>Nothing scheduled for today.</Text>
          ) : null}
          {upcomingDates.length > 0 ? (
            <View>
              <Text style={styles.frequency}>Coming up</Text>
              {upcomingDates.map(date => {
                const tasks = upcomingInTab.filter(task => task.scheduledDate === date);
                return (
                  <View key={date}>
                    <Text style={styles.upcomingDate}>
                      {tasks[0]?.scheduledDateLong || tasks[0]?.scheduledDateLabel}
                    </Text>
                    <AreaList tasks={tasks} busyId={busyId} onComplete={complete} readOnly />
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
        </View>
      )}
      <Modal visible={showStaff} transparent animationType="fade" onRequestClose={() => setShowStaff(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Who completed this?</Text>
            <ScrollView style={styles.modalList}>
              {staff.length === 0 ? (
                <Text style={styles.empty}>Add staff names in Settings on the dashboard.</Text>
              ) : (
                staff.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.staffOption, staffName === name && styles.staffOptionSelected]}
                    onPress={() => {
                      setStaffName(name);
                      setShowStaff(false);
                      const waiting = pendingTask;
                      setPendingTask(null);
                      if (waiting) complete(waiting, name);
                    }}>
                    <Text style={styles.staffOptionText}>{name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowStaff(false);
                setPendingTask(null);
              }}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const AreaList = ({
  tasks,
  busyId,
  onComplete,
  showDate,
  readOnly,
}: {
  tasks: CleaningOccurrence[];
  busyId: string | null;
  onComplete: (task: CleaningOccurrence) => void;
  showDate?: boolean;
  readOnly?: boolean;
}) => (
  <View>
    {groupByArea(tasks).map(area => (
      <View key={area.area} style={styles.areaBlock}>
        <Text style={styles.area}>{area.area}</Text>
        {area.tasks.map(task => (
          <View key={task.uuid} style={styles.card}>
            <Text style={styles.taskName}>
              {task.status === 'overdue' ? '⚠ ' : ''}
              {task.taskName}
            </Text>
            <Text style={styles.due}>
              {showDate && task.scheduledDateLabel ? `${task.scheduledDateLabel} · ` : ''}
              Due {task.dueLabel}
              {task.frequency && task.frequency !== 'daily' && task.scheduleLabel
                ? ` · ${task.scheduleLabel}`
                : ''}
            </Text>
            {task.status === 'overdue' ? <Text style={styles.overdue}>Overdue</Text> : null}
            {task.status === 'completed' ? (
              <Text style={styles.completed}>
                ✓ Completed
                {task.completedAtLabel ? ` at ${task.completedAtLabel}` : ''}
              </Text>
            ) : readOnly ? null : (
              <TouchableOpacity
                style={styles.button}
                disabled={busyId === task.uuid}
                onPress={() => onComplete(task)}>
                <Text style={styles.buttonText}>
                  {busyId === task.uuid ? 'Saving…' : 'Complete'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    ))}
  </View>
);

const Header = () => (
  <>
    <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
    <View style={styles.header}>
      <Text style={styles.title}>Cleaning</Text>
    </View>
  </>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {backgroundColor: '#8A2BE2', paddingHorizontal: 20, paddingVertical: 18},
  title: {color: 'white', fontSize: 22, fontWeight: '700'},
  content: {padding: 16, paddingBottom: 32},
  loader: {marginTop: 40},
  body: {flex: 1},
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 0,
    minHeight: 44,
  },
  activeTab: {
    backgroundColor: '#f8f9fa',
    marginBottom: -12,
    zIndex: 2,
  },
  inactiveTab: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  activeTabText: {color: '#4B4FAE'},
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  staffLabel: {color: '#666', fontWeight: '600'},
  staffValue: {color: '#8A2BE2', fontWeight: '700', flexShrink: 1, marginLeft: 12},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {backgroundColor: 'white', borderRadius: 12, padding: 16, maxHeight: '70%'},
  modalTitle: {fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 12},
  modalList: {flexGrow: 0},
  staffOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
  },
  staffOptionSelected: {borderWidth: 1, borderColor: '#8A2BE2', backgroundColor: '#fff'},
  staffOptionText: {fontSize: 16, color: '#222'},
  modalClose: {marginTop: 8, alignItems: 'center', paddingVertical: 10},
  modalCloseText: {color: '#666', fontWeight: '700'},
  sectionLabel: {fontSize: 13, color: '#666', textTransform: 'uppercase'},
  upcomingDate: {fontSize: 16, fontWeight: '700', color: '#222', marginTop: 8, marginBottom: 4},
  date: {fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 12},
  block: {marginBottom: 8},
  frequency: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginTop: 16,
    marginBottom: 4,
  },
  areaBlock: {marginBottom: 8},
  area: {fontSize: 15, fontWeight: '700', color: '#4A1FB8', marginTop: 8, marginBottom: 6},
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  taskName: {fontSize: 16, fontWeight: '700', color: '#222'},
  due: {marginTop: 4, color: '#555'},
  overdue: {marginTop: 6, color: '#B42318', fontWeight: '700'},
  completed: {marginTop: 8, color: '#067647', fontWeight: '700'},
  button: {
    marginTop: 12,
    backgroundColor: '#8A2BE2',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {color: 'white', fontWeight: '700'},
  empty: {marginTop: 16, color: '#666', fontSize: 15},
  errorBox: {
    backgroundColor: '#FEF3F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {color: '#B42318'},
  retry: {marginTop: 8, color: '#8A2BE2', fontWeight: '700'},
});

export default CleaningPage;

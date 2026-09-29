import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
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
  const [showUpcoming, setShowUpcoming] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [todayRes, overdueRes, upcomingRes] = await Promise.all([
        apiService.getCleaningOccurrences('today'),
        apiService.getCleaningOccurrences('overdue'),
        apiService.getCleaningOccurrences('upcoming'),
      ]);
      setTodayLabel(todayRes.data.todayLabel);
      setToday(todayRes.data.tasks || []);
      setOverdue(overdueRes.data.tasks || []);
      setUpcoming(upcomingRes.data.tasks || []);
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

  const complete = async (task: CleaningOccurrence) => {
    if (task.status === 'completed' || busyId) return;
    const network = await NetInfo.fetch();
    if (!network.isConnected) {
      setError('No network connection. This task was not completed.');
      return;
    }
    setBusyId(task.uuid);
    setError('');
    try {
      const response = await apiService.completeCleaningOccurrence(task.uuid);
      setToday(current =>
        current.map(item => (item.uuid === task.uuid ? response.data : item)),
      );
      setOverdue(current =>
        current.map(item => (item.uuid === task.uuid ? response.data : item)),
      );
    } catch (err: any) {
      setError(err?.message || 'Could not complete this task.');
    } finally {
      setBusyId(null);
    }
  };

  const earlierOverdue = overdue.filter(
    task => !today.some(item => item.uuid === task.uuid),
  );

  const grouped = today.reduce<Record<string, CleaningOccurrence[]>>((groups, task) => {
    const area = task.areaName || 'Other';
    groups[area] = groups[area] || [];
    groups[area].push(task);
    return groups;
  }, {});

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
        <ScrollView
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
          {earlierOverdue.map(task => (
            <View key={task.uuid} style={styles.card}>
              <Text style={styles.taskName}>⚠ {task.taskName}</Text>
              <Text style={styles.due}>
                {task.scheduledDateLabel} · Due {task.dueLabel}
              </Text>
              <Text style={styles.overdue}>Overdue · {task.areaName}</Text>
              {task.status === 'completed' ? (
                <Text style={styles.completed}>
                  ✓ Completed
                  {task.completedAtLabel ? ` at ${task.completedAtLabel}` : ''}
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.button}
                  disabled={busyId === task.uuid}
                  onPress={() => complete(task)}>
                  <Text style={styles.buttonText}>
                    {busyId === task.uuid ? 'Saving…' : 'Complete'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {today.length === 0 ? (
            <Text style={styles.empty}>Nothing scheduled for today.</Text>
          ) : (
            Object.entries(grouped).map(([area, tasks]) => (
              <View key={area} style={styles.areaBlock}>
                <Text style={styles.area}>{area}</Text>
                {tasks.map(task => (
                  <View key={task.uuid} style={styles.card}>
                    <Text style={styles.taskName}>
                      {task.status === 'overdue' ? '⚠ ' : ''}
                      {task.taskName}
                    </Text>
                    <Text style={styles.due}>Due {task.dueLabel}</Text>
                    {task.status === 'overdue' ? (
                      <Text style={styles.overdue}>Overdue</Text>
                    ) : null}
                    {task.status === 'completed' ? (
                      <Text style={styles.completed}>
                        ✓ Completed
                        {task.completedAtLabel ? ` at ${task.completedAtLabel}` : ''}
                      </Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.button}
                        disabled={busyId === task.uuid}
                        onPress={() => complete(task)}>
                        <Text style={styles.buttonText}>
                          {busyId === task.uuid ? 'Saving…' : 'Complete'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.upcomingToggle}
            onPress={() => setShowUpcoming(value => !value)}>
            <Text style={styles.upcomingToggleText}>
              {showUpcoming ? 'Hide upcoming' : 'Upcoming tasks'}
            </Text>
          </TouchableOpacity>
          {showUpcoming ? (
            upcoming.length === 0 ? (
              <Text style={styles.empty}>No upcoming tasks.</Text>
            ) : (
              upcoming.map(task => (
                <View key={task.uuid} style={styles.upcomingCard}>
                  <Text style={styles.upcomingDate}>{task.scheduledDateLabel}</Text>
                  <Text style={styles.taskName}>{task.taskName}</Text>
                  <Text style={styles.due}>
                    {task.areaName} · {task.dueLabel}
                  </Text>
                </View>
              ))
            )
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

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
  sectionLabel: {fontSize: 13, color: '#666', textTransform: 'uppercase'},
  date: {fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 12},
  areaBlock: {marginBottom: 8},
  area: {fontSize: 16, fontWeight: '700', color: '#4A1FB8', marginTop: 8, marginBottom: 6},
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
  upcomingToggle: {marginTop: 12, marginBottom: 8},
  upcomingToggleText: {color: '#8A2BE2', fontWeight: '700'},
  upcomingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  upcomingDate: {color: '#666', fontSize: 12, marginBottom: 2},
});

export default CleaningPage;

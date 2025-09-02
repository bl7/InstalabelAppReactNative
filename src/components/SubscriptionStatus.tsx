import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {AlertTriangle, CheckCircle, Clock} from 'lucide-react-native';
import {useSubscription} from '../contexts/SubscriptionContext';

interface SubscriptionStatusProps {
  showDetails?: boolean;
  onManageSubscription?: () => void;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  showDetails = false,
  onManageSubscription,
}) => {
  const {subscriptionInfo, canPrint, isLoading} = useSubscription();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading subscription...</Text>
      </View>
    );
  }

  const getStatusIcon = () => {
    if (canPrint) {
      return <CheckCircle size={16} color="#4CAF50" />;
    }
    if (subscriptionInfo.isTrialing) {
      return <Clock size={16} color="#FF9800" />;
    }
    return <AlertTriangle size={16} color="#FF6B35" />;
  };

  const getStatusText = () => {
    if (canPrint) {
      return subscriptionInfo.isTrialing ? 'Trial Active' : 'Active';
    }
    if (subscriptionInfo.status === 'no_subscription') {
      return 'No Subscription';
    }
    return (
      subscriptionInfo.status.charAt(0).toUpperCase() +
      subscriptionInfo.status.slice(1)
    );
  };

  const getStatusColor = () => {
    if (canPrint) {
      return subscriptionInfo.isTrialing ? '#FF9800' : '#4CAF50';
    }
    return '#FF6B35';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {getStatusIcon()}
        <Text style={[styles.statusText, {color: getStatusColor()}]}>
          {getStatusText()}
        </Text>
        {subscriptionInfo.planName && (
          <Text style={styles.planName}>• {subscriptionInfo.planName}</Text>
        )}
      </View>

      {showDetails && (
        <View style={styles.detailsContainer}>
          {subscriptionInfo.isTrialing && subscriptionInfo.trialEnd && (
            <Text style={styles.detailText}>
              Trial ends:{' '}
              {new Date(subscriptionInfo.trialEnd).toLocaleDateString()}
            </Text>
          )}

          {subscriptionInfo.cancelAtPeriodEnd && subscriptionInfo.cancelAt && (
            <Text style={styles.detailText}>
              Cancels:{' '}
              {new Date(subscriptionInfo.cancelAt).toLocaleDateString()}
            </Text>
          )}

          {!canPrint && onManageSubscription && (
            <TouchableOpacity
              style={styles.manageButton}
              onPress={onManageSubscription}>
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  planName: {
    fontSize: 14,
    color: '#666',
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  manageButton: {
    backgroundColor: '#8A2BE2',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default SubscriptionStatus;

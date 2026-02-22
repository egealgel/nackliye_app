import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CompletedLoadWithDetails,
  formatWeight,
  formatDate,
} from '@/types/load';

type Props = {
  load: CompletedLoadWithDetails;
  currentUserId: string;
};

function Stars({ count }: { count: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={count >= s ? 'star' : 'star-outline'}
          size={14}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

export default function JobCompletedCard({ load, currentUserId }: Props) {
  const isOwner = currentUserId === load.user_id;
  const otherName = isOwner ? load.assignedDriverName : load.ownerName;
  const dateStr = formatDate(load.updated_at || load.created_at);

  return (
    <View style={styles.card}>
      <View style={styles.routeRow}>
        <View style={[styles.dot, styles.dotOrigin]} />
        <Text style={styles.routeText}>
          {load.from_city} / {load.from_district || load.from_city}
        </Text>
      </View>

      <View style={styles.routeRow}>
        <View style={[styles.dot, styles.dotDest]} />
        <Text style={styles.routeText}>
          {load.to_city} / {load.to_district || load.to_city}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="package-variant" size={16} color="#6B7280" />
          <Text style={styles.metaText}>{formatWeight(load.weight_kg)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>
      </View>

      <View style={styles.partyRow}>
        <Text style={styles.partyLabel}>Karşı Taraf:</Text>
        <Text style={styles.partyName}>{otherName || 'Bilinmiyor'}</Text>
      </View>

      <View style={styles.ratingsRow}>
        {load.ratingGiven != null && (
          <View style={styles.ratingItem}>
            <Text style={styles.ratingLabel}>Verdiğiniz puan</Text>
            <Stars count={load.ratingGiven} />
          </View>
        )}
        {load.ratingReceived != null && (
          <View style={styles.ratingItem}>
            <Text style={styles.ratingLabel}>Aldığınız puan</Text>
            <Stars count={load.ratingReceived} />
          </View>
        )}
        {load.ratingGiven == null && load.ratingReceived == null && (
          <Text style={styles.noRating}>Henüz puan yok</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    flexShrink: 0,
  },
  dotOrigin: {
    backgroundColor: '#16A34A',
  },
  dotDest: {
    backgroundColor: '#DC2626',
  },
  routeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  partyRow: {
    marginBottom: 12,
  },
  partyLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  ratingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  noRating: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

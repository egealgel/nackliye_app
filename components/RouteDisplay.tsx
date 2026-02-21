import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  fromCity: string;
  fromDistrict: string;
  toCity: string;
  toDistrict: string;
};

export default function RouteDisplay({
  fromCity,
  fromDistrict,
  toCity,
  toDistrict,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.arrowCol}>
        <Text style={styles.arrow}>↓</Text>
      </View>
      <View style={styles.linesCol}>
        <View style={[styles.line, styles.lineFirst]}>
          <View style={[styles.dot, styles.dotOrigin]} />
          <Text style={styles.city}>{fromCity}</Text>
          <Text style={styles.slash}> / </Text>
          <Text style={styles.district}>{fromDistrict}</Text>
        </View>
        <View style={styles.line}>
          <View style={[styles.dot, styles.dotDest]} />
          <Text style={styles.city}>{toCity}</Text>
          <Text style={styles.slash}> / </Text>
          <Text style={styles.district}>{toDistrict}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
  },
  arrowCol: {
    paddingTop: 12,
    paddingRight: 8,
    alignItems: 'center',
  },
  arrow: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  linesCol: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  lineFirst: {
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotOrigin: {
    backgroundColor: '#16A34A',
  },
  dotDest: {
    backgroundColor: '#DC2626',
  },
  city: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  slash: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  district: {
    fontSize: 13,
    fontWeight: '400',
    color: '#1F2937',
  },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PinLocation01Icon } from '@hugeicons/core-free-icons';
import { fetchEstates, fetchEstateProperties } from '../../api/estates';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { formatNaira } from '../../utils/format';
import { colors, spacing } from '../../theme';

// Status → legend color. Kept in one map so the grid, the legend, and the
// selected-plot card can never drift apart.
const STATUS_COLORS = {
  available: colors.success,
  reserved: colors.warning,
  under_offer: colors.info,
  sold: colors.danger,
  allocated: '#8B5CF6',
  unavailable: colors.textMuted,
};

const STATUS_LABELS = {
  available: 'Available',
  reserved: 'Reserved',
  under_offer: 'Under offer',
  sold: 'Sold',
  allocated: 'Allocated',
  unavailable: 'Unavailable',
};

// The plot map screen the platform plan called for but never had: a grid
// "map" of an estate's plots colored by sale status. Deliberately built without
// a native maps dependency — plots are laid out in plot-number order, which is
// how estate managers actually think about their layouts.
export function PlotMapScreen() {
  const [estates, setEstates] = useState([]);
  const [estateId, setEstateId] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadEstates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchEstates();
      const list = data.estates || [];
      setEstates(list);
      setEstateId((current) => current ?? (list.length ? String(list[0].id) : null));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEstates();
  }, [loadEstates]);

  useEffect(() => {
    let mounted = true;

    if (!estateId) {
      setProperties([]);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const data = await fetchEstateProperties(estateId);
        if (mounted) {
          setProperties(data.properties || []);
          setSelected(null);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [estateId]);

  const countsByStatus = useMemo(() => {
    const counts = {};
    for (const property of properties) {
      counts[property.status] = (counts[property.status] || 0) + 1;
    }
    return counts;
  }, [properties]);

  const activeEstate = estates.find((estate) => String(estate.id) === String(estateId));

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="title">Plot map</AppText>
          <AppText muted>Every plot in the estate, colored by its current sale status.</AppText>
        </View>

        {error ? <StatusChip label={error} tone="danger" /> : null}

        {estates.length ? (
          <View style={styles.estatePicker}>
            {estates.map((estate) => (
              <Pressable
                key={estate.id}
                accessibilityRole="button"
                onPress={() => setEstateId(String(estate.id))}
                style={[styles.estatePill, String(estate.id) === String(estateId) && styles.estatePillActive]}
              >
                <AppText
                  variant="small"
                  style={[styles.estatePillText, String(estate.id) === String(estateId) && styles.estatePillTextActive]}
                  numberOfLines={1}
                >
                  {estate.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {activeEstate ? (
          <AppText muted>
            {activeEstate.location ? `${activeEstate.name} · ${activeEstate.location}` : activeEstate.name}
          </AppText>
        ) : null}

        <View style={styles.legend}>
          {Object.keys(STATUS_COLORS)
            .filter((status) => countsByStatus[status])
            .map((status) => (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[status] }]} />
                <AppText variant="small" style={styles.legendText}>
                  {STATUS_LABELS[status]} ({countsByStatus[status]})
                </AppText>
              </View>
            ))}
        </View>

        {properties.length ? (
          <View style={styles.mapGrid}>
            {properties.map((property) => (
              <Pressable
                key={property.id}
                accessibilityRole="button"
                onPress={() => setSelected(property)}
                style={[
                  styles.plot,
                  { backgroundColor: STATUS_COLORS[property.status] || colors.textMuted },
                  selected?.id === property.id && styles.plotSelected,
                ]}
              >
                <AppText variant="small" style={styles.plotNumber} numberOfLines={1}>
                  {property.plotNumber || `#${property.id}`}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={PinLocation01Icon}
            title={estateId ? 'No plots yet' : 'No estates yet'}
            body={
              estateId
                ? 'Add properties to this estate and they will appear on the map.'
                : 'Create an estate first, then its plots will show up here.'
            }
          />
        )}

        {selected ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <AppText variant="heading">{selected.plotNumber || `Plot #${selected.id}`}</AppText>
              <StatusChip
                label={STATUS_LABELS[selected.status] || selected.status}
                tone={selected.status === 'available' ? 'success' : selected.status === 'sold' || selected.status === 'allocated' ? 'danger' : 'warning'}
              />
            </View>
            {selected.propertyType ? <AppText muted>Type: {selected.propertyType}</AppText> : null}
            {selected.plotSize ? <AppText muted>Size: {selected.plotSize}</AppText> : null}
            <AppText muted>Price: {formatNaira(selected.price)}</AppText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 60,
  },
  header: {
    gap: spacing.sm,
  },
  estatePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  estatePill: {
    maxWidth: '100%',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  estatePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  estatePillText: {
    color: colors.textMuted,
  },
  estatePillTextActive: {
    color: colors.onPrimary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textMuted,
  },
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  plot: {
    width: 72,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
  },
  plotSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  plotNumber: {
    color: '#0B1220',
    fontWeight: '700',
  },
  detailCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});

import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorNote, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { Sheet } from '@/motion/sheet';
import { api, receiptImageUrl } from '@/services/api';
import { formatDateTime } from '@/services/format';
import type { Receipt } from '@/services/types';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useRequest(() => api<Receipt>(`/api/v1/receipts/${id}`), [id]);
  const url = receiptImageUrl(id);

  return (
    <Sheet>
      <Screen title="Receipt" subtitle={data ? `${Math.round(data.byte_size / 1024)} KB · ${formatDateTime(data.created_at)}` : undefined} back>
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        {!data && !error ? <Loading /> : null}
        {data?.content_type === 'application/pdf' ? (
          <View style={styles.pdf}>
            <ThemedText themeColor="textSecondary">PDF receipt</ThemedText>
            <Button title={Platform.OS === 'web' ? 'Open in new tab' : 'Open'} onPress={() => Linking.openURL(url)} />
          </View>
        ) : data ? (
          <Image source={{ uri: url }} style={styles.image} contentFit="contain" transition={200} />
        ) : null}
        {data?.extraction_status === 'done' && data.extraction ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Read by {data.extraction_model}: {[data.extraction.vendor, data.extraction.spent_on, data.extraction.total !== null ? `${data.extraction.currency ?? ''} ${data.extraction.total}` : null].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
      </Screen>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  image: { flex: 1, margin: Spacing.three },
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  note: { padding: Spacing.three, textAlign: 'center' },
});

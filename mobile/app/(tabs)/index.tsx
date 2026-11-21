import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AedGuideEntry } from '@/components/aed/AedGuideEntry';
import { EmergencyEntryButton } from '@/components/aed/EmergencyEntryButton';

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleContainer}>
          <Image
            source={require('../../assets/images/ikonamobywatel.jpg')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.title} accessibilityRole="header">
            Dokumenty
          </Text>
        </View>

        <EmergencyEntryButton />
        <AedGuideEntry />

        <View style={styles.configView}>
          <Text style={styles.configText}>Dostosuj</Text>
          <Text style={styles.configText}>Dodaj</Text>
        </View>
        <Image
          source={require('../../assets/images/kartymobywatel.jpg')}
          style={styles.documents}
          resizeMode="contain"
          accessibilityLabel="Twoje dokumenty: mDowód i inne"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(245, 246, 252)',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  titleContainer: {
    alignItems: 'flex-start',
    gap: 2,
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  configView: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingRight: 14,
  },
  configText: {
    color: '#0052A5',
    fontSize: 16,
    fontWeight: '500',
  },
  documents: {
    width: '100%',
    height: 500,
  },
});

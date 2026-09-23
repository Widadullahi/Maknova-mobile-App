import { useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { colors, spacing } from '../../theme';

const slides = [
  {
    key: 'verified-estates',
    eyebrow: 'VERIFIED ESTATES',
    title: 'No estate goes live until it is verified.',
    description:
      'Estate management teams submit planning approval, land title, and survey documents. Every application is reviewed and approved before a single plot is published.',
    image: require('../../../assets/onboarding/estate-layout-review.jpg'),
  },
  {
    key: 'plot-lifecycle',
    eyebrow: 'PLOT LIFECYCLE',
    title: 'Every plot tracked, from listed to allocated.',
    description:
      'Manage inventory, reserve plots for buyers, record sales, and finalize allocations, with a full status history behind every property.',
    image: require('../../../assets/onboarding/plot-under-construction.jpg'),
  },
  {
    key: 'resident-operations',
    eyebrow: 'ESTATE OPERATIONS',
    title: 'Residents, security, and reports in one place.',
    description:
      'Approve visitors, verify residents, track maintenance requests, and manage billing, communication, and admin oversight from a single platform.',
    image: require('../../../assets/onboarding/subdivided-estate.jpg'),
  },
];

export function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const listRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [index, setIndex] = useState(0);
  const compact = height < 720;
  const tiny = height < 650 || width < 360;
  const heroHeight = Math.min(
    Math.max(height * (compact ? 0.4 : 0.46), tiny ? 240 : 280),
    compact ? 320 : 400
  );

  function goToSlide(nextIndex) {
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setIndex(nextIndex);
  }

  function handleNext() {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.975,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    if (index === slides.length - 1) {
      onDone();
      return;
    }

    goToSlide(index + 1);
  }

  function handleMomentumEnd(event) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(nextIndex);
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.md) }]}>
      <Animated.FlatList
        ref={listRef}
        data={slides}
        horizontal
        keyExtractor={(item) => item.key}
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index: slideIndex }) => (
          <OnboardingSlide
            slide={item}
            slideIndex={slideIndex}
            width={width}
            heroHeight={heroHeight}
            compact={compact}
            tiny={tiny}
            scrollX={scrollX}
            onSkip={onDone}
          />
        )}
      />

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        <ProgressIndicator scrollX={scrollX} width={width} />
        <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={index === slides.length - 1 ? 'Enter platform' : 'Next onboarding slide'}
            onPress={handleNext}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <AppText style={styles.ctaText}>
              {index === slides.length - 1 ? 'Get started' : 'Next'}
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function OnboardingSlide({ slide, slideIndex, width, heroHeight, compact, tiny, scrollX, onSkip }) {
  const inputRange = [
    (slideIndex - 1) * width,
    slideIndex * width,
    (slideIndex + 1) * width,
  ];
  const contentOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.2, 1, 0.2],
    extrapolate: 'clamp',
  });
  const contentTranslateY = scrollX.interpolate({
    inputRange,
    outputRange: [14, 0, 14],
    extrapolate: 'clamp',
  });
  const imageTranslateX = scrollX.interpolate({
    inputRange,
    outputRange: [24, 0, -24],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.heroWrap, { height: heroHeight }]}>
        <Animated.View
          style={[
            styles.imageMotion,
            { transform: [{ translateX: imageTranslateX }] },
          ]}
        >
          <ImageBackground source={slide.image} style={styles.heroImage} imageStyle={styles.heroImageStyle}>
            <View style={styles.photoOverlay} />
          </ImageBackground>
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          onPress={onSkip}
          style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
        >
          <AppText style={styles.skipText}>Skip</AppText>
        </Pressable>

        <View style={styles.slideNumber}>
          <AppText style={styles.slideNumberText}>
            {String(slideIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </AppText>
        </View>
      </View>

      <Animated.View
        style={[
          styles.copy,
          compact && styles.copyCompact,
          { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] },
        ]}
      >
        <AppText style={styles.eyebrow}>{slide.eyebrow}</AppText>
        <AppText style={[styles.title, compact && styles.titleCompact, tiny && styles.titleTiny]}>
          {slide.title}
        </AppText>
        <AppText style={[styles.description, tiny && styles.descriptionTiny]}>{slide.description}</AppText>
      </Animated.View>
    </View>
  );
}

function ProgressIndicator({ scrollX, width }) {
  return (
    <View style={styles.progress} accessibilityLabel="Onboarding progress">
      {slides.map((slide, index) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        const indicatorWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 28, 8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={slide.key}
            style={[
              styles.progressDot,
              { width: indicatorWidth, opacity },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  heroWrap: {
    marginHorizontal: -spacing.sm,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  imageMotion: {
    width: '112%',
    height: '100%',
    marginLeft: '-6%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  skip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    minHeight: 40,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(10, 10, 12, 0.5)',
  },
  skipPressed: {
    opacity: 0.82,
  },
  skipText: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  slideNumber: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.lg,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 10, 12, 0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  slideNumberText: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  copy: {
    paddingTop: 28,
    gap: spacing.md,
  },
  copyCompact: {
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    maxWidth: 380,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 33,
  },
  titleTiny: {
    fontSize: 25,
    lineHeight: 30,
  },
  description: {
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 390,
  },
  descriptionTiny: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    gap: spacing.lg,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  progressDot: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  cta: {
    minHeight: 58,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    color: colors.onPrimary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    lineHeight: 22,
  },
});

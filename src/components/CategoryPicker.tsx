import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORIES, Category } from '../types/Item';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

interface Props {
  value: Category;
  onChange: (category: Category) => void;
}

export default function CategoryPicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CATEGORIES.map((category) => {
        const selected = category === value;
        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 14,
      color: colors.text,
    },
    chipTextSelected: {
      color: colors.white,
      fontWeight: '600',
    },
  });

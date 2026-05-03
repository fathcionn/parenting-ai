import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { theme } from '../styles/theme';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  placeholder?: string;
}

export const TextField: React.FC<TextInputProps> = ({
  label,
  error,
  placeholder,
  ...props
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          props.style,
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.label.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.label.fontSize,
    marginTop: theme.spacing.sm,
  },
});

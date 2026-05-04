// LEGACY FILE — Not used by current Gemini/MediaRecorder flow. Safe to delete.
import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Container, Card } from '../components/Layout';

export const ReportsScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Container scroll>
      <Card title={t('insights_title')}>
        <Text>{t('insights_no_data')}</Text>
      </Card>
    </Container>
  );
};

import type { Metadata } from 'next';
import MatrixClient from './matrix-client';

export const metadata: Metadata = {
  title: 'CASE MATRIX · ORAL / 26',
  description: 'Complete FMH orthopaedics oral case overview.',
  openGraph: {
    title: 'CASE MATRIX · ORAL / 26',
    description: 'FMH ORTHOPAEDICS · 123 HISTORICAL CASES',
  },
  twitter: {
    title: 'CASE MATRIX · ORAL / 26',
    description: 'FMH ORTHOPAEDICS · 123 HISTORICAL CASES',
  },
};

export default function MatrixPage() {
  return <MatrixClient />;
}

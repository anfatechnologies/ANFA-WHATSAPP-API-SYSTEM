// /frontend/src/app/layout.tsx
// ANFA Root Layout - Server-rendered with JSON-LD schema markup
// Includes Programmatic SEO configurations for AI crawlers and search engines.

import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/providers/query-provider';
import { Toaster } from 'sonner';

// =============================================================================
// METADATA
// =============================================================================

export const metadata: Metadata = {
  title: 'ANFA WhatsApp Platform | Open-Source Shared Inbox & CRM',
  description:
    'Deploy a self-hosted, local-first WhatsApp CRM on your own infrastructure with complete data sovereignty. ' +
    'Open-source WhatsApp Business API management platform built with FastAPI, PostgreSQL, and Next.js.',
  keywords: [
    'WhatsApp CRM',
    'self-hosted',
    'open-source',
    'WhatsApp API',
    'data sovereignty',
    'privacy-first',
    'FastAPI',
    'PostgreSQL',
    'message queue',
  ],
  authors: [{ name: 'ANFA Technology' }],
  creator: 'ANFA Technology',
  publisher: 'ANFA Technology',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://anfa.tech',
    siteName: 'ANFA WhatsApp Platform',
    title: 'ANFA WhatsApp Platform | Self-Hosted CRM',
    description:
      'Self-hosted WhatsApp CRM with complete data sovereignty. ' +
      'Open-source, privacy-first, production-ready.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANFA WhatsApp Platform',
    description: 'Self-hosted WhatsApp CRM with complete data sovereignty',
    creator: '@anfatech',
  },
  alternates: {
    canonical: 'https://anfa.tech',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

// =============================================================================
// JSON-LD SCHEMA
// =============================================================================

function generateJsonLdSchema() {
  const baseUrl = 'https://anfa.tech';
  
  // Combine SoftwareApplication, Organization, and FAQPage schemas
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      // SoftwareApplication schema for rich search results
      {
        '@type': 'SoftwareApplication',
        '@id': `${baseUrl}/#software`,
        name: 'ANFA WhatsApp Platform',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Docker',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Open-source, self-hosted',
        },
        description:
          'Self-hosted WhatsApp CRM and API management platform with absolute data sovereignty. ' +
          'Built with FastAPI, PostgreSQL 16, Redis, and Next.js.',
        url: baseUrl,
        author: {
          '@id': `${baseUrl}/#organization`,
        },
        featureList: [
          'Self-hosted deployment',
          'Absolute data sovereignty',
          'Real-time messaging via SSE',
          'Multi-agent shared inbox',
          'HMAC-SHA256 webhook security',
          'PostgreSQL range partitioning',
          'Redis-backed task queue',
          'Server-Sent Events streaming',
        ],
        softwareRequirements: 'Docker 24.0+, 4GB RAM',
        programmingLanguage: ['Python', 'TypeScript'],
        license: 'https://opensource.org/licenses/MIT',
      },
      // Organization schema
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'ANFA Technology',
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/logo.png`,
        },
        sameAs: [
          'https://github.com/anfa-tech',
        ],
        description:
          'Building privacy-first, self-hosted communication infrastructure. ' +
          'ANFA Technology specializes in local-first software with absolute data sovereignty.',
      },
      // FAQPage schema for rich results
      {
        '@type': 'FAQPage',
        '@id': `${baseUrl}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is ANFA WhatsApp Platform fully self-hosted?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. The entire stack including the database, cache, backend, and frontend runs on your own infrastructure. ' +
                'No data ever leaves your servers or touches third-party services (except Meta WhatsApp API for message delivery).',
            },
          },
          {
            '@type': 'Question',
            name: 'What are the system requirements?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Minimum 4GB RAM, Docker Engine 24.0+, and Docker Compose v2.20+. ' +
                'Recommended 8GB RAM for production workloads with high message volume.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does ANFA store my WhatsApp messages on external servers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. All messages are stored in your own PostgreSQL database with native range partitioning. ' +
                'ANFA has no access to your data, and no analytics or telemetry are collected.',
            },
          },
          {
            '@type': 'Question',
            name: 'How is webhook security handled?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'All incoming webhooks are verified using HMAC-SHA256 signature validation with constant-time comparison ' +
                'to prevent timing attacks. Credentials are stored per phone number in Redis for dynamic lookup.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is the platform open-source?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. ANFA WhatsApp Platform is released under the MIT License. ' +
                'You can view, modify, and distribute the source code freely.',
            },
          },
        ],
      },
    ],
  };
  
  return schema;
}

// =============================================================================
// ROOT LAYOUT COMPONENT
// =============================================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLdSchema = generateJsonLdSchema();
  
  return (
    <html lang="en">
      <head>
        {/* JSON-LD Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdSchema),
          }}
        />
        {/* Preconnect to API for faster data fetching */}
        <link rel="preconnect" href="/api" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* llms.txt reference for AI crawlers */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs file" />
      </head>
      <body className="min-h-screen bg-anfa-dark text-anfa-text antialiased">
        <Providers>
          {children}
        </Providers>
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}

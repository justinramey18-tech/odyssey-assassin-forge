/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for Odyssey</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset Your Password</Heading>
        <Text style={text}>
          A request was made to reset your Odyssey password. Click below to choose a new one.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Cinzel', 'Georgia', serif" }
const container = { padding: '32px 28px', borderTop: '4px solid #c9a227' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#2a1f14', margin: '0 0 20px', fontFamily: "'Cinzel', 'Georgia', serif" }
const text = { fontSize: '15px', color: '#4a3c2e', lineHeight: '1.6', margin: '0 0 22px', fontFamily: "'Georgia', serif" }
const button = { backgroundColor: '#4a3c2e', color: '#d4c4a0', fontSize: '15px', borderRadius: '4px', padding: '14px 28px', textDecoration: 'none', fontFamily: "'Cinzel', 'Georgia', serif", letterSpacing: '0.1em', border: '2px solid #8b7355' }
const footer = { fontSize: '12px', color: '#8a7a60', margin: '30px 0 0', fontFamily: "'Georgia', serif" }

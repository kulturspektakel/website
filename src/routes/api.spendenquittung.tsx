import {createFileRoute} from '@tanstack/react-router';
import {
  renderToStream,
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import {Readable} from 'node:stream';
import {prismaClient} from '../utils/prismaClient';
import React from 'react';
import n2words from 'n2words/i18n/de.js';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Space Grotesk',
    flexDirection: 'column',
    fontSize: 10,
    paddingHorizontal: '2cm',
    paddingVertical: '1.4cm',
    lineHeight: 1.4,
    gap: '0.3cm',
  },
  logo: {
    width: '4cm',
    alignSelf: 'flex-end',
  },
  heading: {
    fontFamily: 'Shrimp',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: '2mm',
    textTransform: 'uppercase',
    marginTop: '3mm',
  },
  label: {
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: -8,
    marginLeft: -6,
  },
  section: {
    border: '1px solid black',
    padding: 10,
    paddingBottom: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
  small: {
    flexDirection: 'column',
    gap: '0.1cm',
    lineHeight: 1.35,
    fontSize: 8,
  },
  spacer: {
    flexGrow: 1,
  },
  date: {
    textAlign: 'right',
    marginTop: '2cm',
  },
  footer: {
    fontSize: 8,
    lineHeight: 1.35,
    marginTop: '0.5cm',
    gap: '0.5cm',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1mm',
    justifyContent: 'flex-end',
  },
  footerTitle: {
    fontFamily: 'Shrimp',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export const Route = createFileRoute('/api/spendenquittung')({
  server: {
    handlers: {
      POST: async ({request}) => {
        console.log(process.env.NODE_ENV, request.headers);
        const host =
          (process.env.NODE_ENV === 'development' ? 'http://' : 'https://') +
          request.headers.get('host');
        const formData = await request.formData();

        Font.register({
          family: 'Shrimp',
          src: `${host}/styles/shrimp-webfont.woff`,
        });

        Font.register({
          family: 'Space Grotesk',
          src: `${host}/styles/space-grotesk-latin-400-normal.woff`,
        });

        Font.register({
          family: 'Space Grotesk',
          fontWeight: 'bold',
          src: `${host}/styles/space-grotesk-latin-600-normal.woff`,
        });

        const id = formData.get('id')?.toString() ?? '';
        const name = formData.get('name')?.toString() ?? '';
        const street = formData.get('street')?.toString() ?? '';
        const city = formData.get('city')?.toString() ?? '';

        const donation = await prismaClient.donation.findFirstOrThrow({
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
          where: {
            id,
          },
        });

        const stream = await renderToStream(
          <Document language="de">
            <Page size="A4" style={styles.page}>
              <Image src={`${host}/logos/logo-wide.png`} style={styles.logo} />
              <Text style={styles.date}>
                Gauting,{' '}
                {new Date().toLocaleDateString('de-DE', {
                  month: 'long',
                  timeZone: 'Europe/Berlin',
                  year: 'numeric',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.heading}>Bestätigung über Geldzuwendung</Text>
              <Text>
                im Sinne des § 10b des Einkommensteuergesetzes an eine der in §
                5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten
                Körperschaften, Personenvereinigungen oder Vermögensmassen
              </Text>
              <Section label="Name und Anschrift des/der Zuwendenden:">
                <Text>{name}</Text>
                <Text>{street}</Text>
                <Text>{city}</Text>
              </Section>
              <Section label="Zuwendung:">
                <Text>
                  Betrag:{' '}
                  {new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(donation.amount / 100)}{' '}
                  (in Worten: {n2words(Math.floor(donation.amount / 100), {})}{' '}
                  Euro und {n2words(donation.amount % 100, {})} Cent)
                </Text>
                <Text>
                  Tag der Zuwendung:{' '}
                  {donation.createdAt.toLocaleDateString('de-DE', {
                    timeZone: 'Europe/Berlin',
                  })}
                </Text>
                <Text>Referenz: {donation.id}</Text>
              </Section>
              <View>
                <Text>
                  Es handelt sich nicht um den Verzicht auf Erstattung von
                  Aufwendungen.
                </Text>
              </View>
              <Text>
                Wir sind wegen der Förderung von Kunst und Kultur nach dem
                Freistellungsbescheid bzw. nach der Anlage zum
                Körperschaftsteuerbescheid des Finanzamtes Fürstenfeldbruck
                StNr. 117/109/60900 vom 05.07.2024 nach § 5 Abs. 1 Nr. 9 des
                Körperschaftsteuergesetzes von der Körperschaftsteuer und nach §
                3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.
              </Text>
              <Text>
                Es wird bestätigt, dass die Zuwendung nur zur Förderung der
                Kunst und Kultur verwendet wird.
              </Text>

              <Text>Valentin Langer, Kassenwart</Text>

              <View style={styles.spacer} />
              <View style={styles.small}>
                <Text style={styles.bold}>Hinweis:</Text>
                <Text>
                  Wer vorsätzlich oder grob fahrlässig eine unrichtige
                  Zuwendungsbestätigung erstellt oder veranlasst, dass
                  Zuwendungen nicht zu den in der Zuwendungsbestätigung
                  angegebenen steuerbegünstigten Zwecken verwendet werden,
                  haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs.
                  3 KStG, § 9 Nr. 5 GewStG).
                </Text>
                <Text>
                  Diese Bestätigung wird nicht als Nachweis für die steuerliche
                  Berücksichtigung der Zuwendung anerkannt, wenn das Datum des
                  Freistellungsbescheides länger als 5 Jahre bzw. das Datum der
                  Feststellung der Einhaltung der satzungsmäßigen
                  Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit
                  Ausstellung des Bescheides zurückliegt (§ 63 Abs. 5 AO).
                </Text>
              </View>
              <View style={styles.footer}>
                <View style={styles.footerCol}>
                  <Text style={styles.footerTitle}>
                    Kulturspektakel Gauting e.V.
                  </Text>
                  <View>
                    <Text>Bahnhofstraße 6</Text>
                    <Text>82131 Gauting</Text>
                  </View>
                  <View>
                    <Text>info@kulturspektakel.de</Text>
                    <Text>www.kulturspektakel.de</Text>
                    <Text>@kulturspektakel</Text>
                  </View>
                </View>
                <View style={styles.footerCol}>
                  <View>
                    <Text>Vertreten durch: Maximilian Schrake,</Text>
                    <Text>Gabriel Knoll und Tristan Häuser</Text>
                  </View>
                  <View>
                    <Text>Schriftführer: Anton Sanktjohanser</Text>
                    <Text>Kassenwart: Valentin Langer</Text>
                    <Text>Beisitzer: Simon zur Weihen, Kristian Aumayer</Text>
                  </View>
                </View>
                <View style={styles.footerCol}>
                  <View>
                    <Text>Registergericht: Amtsgericht München</Text>
                    <Text>Registernummer: VR 70819</Text>
                  </View>
                  <View>
                    <Text>Kreissparkasse Starnberg</Text>
                    <Text>IBAN: DE71 7025 0150 0620 0007 52</Text>
                    <Text>BIC: BYLADEM1KMS</Text>
                  </View>
                </View>
              </View>
            </Page>
          </Document>,
        );

        return new Response((Readable as any).toWeb(stream), {
          headers: {'Content-Type': 'application/pdf'},
        });
      },
    },
  },
});

const Section = ({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.label}>{label}</Text>
    {React.Children.map(children, (child) =>
      typeof child === 'string' ? <Text>{child}</Text> : child,
    )}
  </View>
);

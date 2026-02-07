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
import {prismaClient} from '../utils/prismaClient.server';
import React from 'react';
import {de} from 'n2words';

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
  signature: {
    width: '3.5cm',
    marginBottom: '-6mm',
    marginLeft: '3mm',
  },
});

const SIGNATURE = `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`;

export const Route = createFileRoute('/api/spenden/quittung/$id')({
  server: {
    handlers: {
      GET: async ({request, params}) => {
        const origin =
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : 'https://www.kulturspektakel.de';

        Font.register({
          family: 'Shrimp',
          src: `${origin}/styles/shrimp-webfont.woff`,
        });

        Font.register({
          family: 'Space Grotesk',
          src: `${origin}/styles/space-grotesk-latin-400-normal.woff`,
        });

        Font.register({
          family: 'Space Grotesk',
          fontWeight: 'bold',
          src: `${origin}/styles/space-grotesk-latin-600-normal.woff`,
        });

        const donation = await prismaClient.donation.findFirstOrThrow({
          select: {
            id: true,
            amount: true,
            createdAt: true,
            quittungName: true,
            quittungStreet: true,
            quittungCity: true,
            spendenQuittungAt: true,
          },
          where: {
            id: params.id,
            spendenQuittungAt: {
              not: null,
            },
          },
        });

        const stream = await renderToStream(
          <Document language="de">
            <Page size="A4" style={styles.page}>
              <Image
                src={`${origin}/logos/logo-wide.png`}
                style={styles.logo}
              />
              <Text style={styles.date}>
                Gauting,{' '}
                {donation.spendenQuittungAt!.toLocaleDateString('de-DE', {
                  month: 'long',
                  timeZone: 'Europe/Berlin',
                  year: 'numeric',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.heading}>Bestätigung über Geldzuwendung</Text>
              <Text>
                im Sinne des § 10b des Einkommensteuergesetzes an eine der in §
                5 Abs. 1 Nr. 9 des Körperschaft- steuergesetzes bezeichneten
                Körperschaften, Personenvereinigungen oder Vermögensmassen
              </Text>
              <Section label="Name und Anschrift des/der Zuwendenden:">
                <Text>{donation.quittungName ?? ''}</Text>
                <Text>{donation.quittungStreet ?? ''}</Text>
                <Text>{donation.quittungCity ?? ''}</Text>
              </Section>
              <Section label="Zuwendung:">
                <Text>
                  Betrag:{' '}
                  {new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(donation.amount / 100)}{' '}
                  (in Worten:{' '}
                  {de(Math.floor(donation.amount / 100)).replace(
                    /eins$/,
                    'ein',
                  )}{' '}
                  Euro und {de(donation.amount % 100).replace(/eins$/, 'ein')}{' '}
                  Cent)
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

              <Image
                style={styles.signature}
                src={`data:image/png;base64,${SIGNATURE}`}
              />
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

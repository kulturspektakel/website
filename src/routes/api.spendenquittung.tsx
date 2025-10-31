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

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Space Grotesk',
    flexDirection: 'column',
    fontSize: 10,
    paddingHorizontal: '2cm',
    paddingVertical: '2cm',
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
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  section: {
    border: '1px solid black',
    padding: 10,
  },
  bold: {
    fontWeight: 'bold',
  },
  small: {
    flexDirection: 'column',
    gap: '0.1cm',
    lineHeight: 1.35,
    fontSize: 9,
  },
  footer: {
    lineHeight: 1.35,
    fontSize: 9,
    gap: '0.5cm',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export const Route = createFileRoute('/api/spendenquittung')({
  server: {
    handlers: {
      GET: async ({request}) => {
        const host = 'http://' + request.headers.get('host');

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

        const donation = await prismaClient.donation.findFirstOrThrow({
          select: {
            name: true,
            amount: true,
            createdAt: true,
            source: true,
          },
          where: {
            id: '1',
          },
        });

        const stream = await renderToStream(
          <Document>
            <Page size="A4" style={styles.page}>
              <Image src={`${host}/logos/logo-wide.png`} style={styles.logo} />
              <Section label="Aussteller (Bezeichnung und Anschrift der steuerbegünstigten Einrichtung)">
                Kulturspektakel Gauting e.V.
                <br />
                Bahnhofstr. 6<br />
                82131 Gauting
              </Section>
              <Text style={styles.heading}>
                Bestätigung über Geldzuwendungen
              </Text>
              <Text>
                im Sinne des § 10b des Einkommensteuergesetzes an eine der in §
                5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten
                Körperschaften, Personenvereinigungen oder Vermögensmassen
              </Text>
              <Section label="Name und Anschrift des Zuwendenden:">
                {donation.name}
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
              <Text>
                Gauting,{' '}
                {new Date().toLocaleDateString('de-DE', {
                  month: 'long',
                  timeZone: 'Europe/Berlin',
                  year: 'numeric',
                  day: 'numeric',
                })}
              </Text>
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
                  Freistellungs- bescheides länger als 5 Jahre bzw. das Datum
                  der Feststellung der Einhaltung der satzungsmäßigen
                  Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit
                  Ausstellung des Bescheides zurückliegt (§ 63 Abs. 5 AO).
                </Text>
              </View>
              <View style={styles.footer}>
                <View>
                  <Text>Kulturspektakel Gauting</Text>
                  Bahnhofstraße 6<br />
                  82131 Gauting
                </View>
                <View>
                  <Text>Kulturspektakel Gauting</Text>
                  Bahnhofstraße 6<br />
                  82131 Gauting
                </View>
                <View>
                  <Text>Kulturspektakel Gauting</Text>
                  Bahnhofstraße 6<br />
                  82131 Gauting
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
    <Text>{label}</Text>
    {React.Children.map(children, (child) =>
      typeof child === 'string' ? <Text>{child}</Text> : child,
    )}
  </View>
);

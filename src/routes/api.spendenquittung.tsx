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

Font.register({
  family: 'Shrimp',
  src: 'https://www.kulturspektakel.de/styles/shrimp-webfont.woff2',
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
  },
  section: {
    fontFamily: 'Shrimp',
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
});

export const Route = createFileRoute('/api/spendenquittung')({
  server: {
    handlers: {
      GET: async ({request}) => {
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
              <Image
                src="https://kulturspektakel.de/logos/logo.png"
                style={{width: 100, height: 100}}
              />
              <View style={styles.section}>
                <Text>{donation.name}</Text>
              </View>
              <View style={styles.section}>
                <Text>Section #2</Text>
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

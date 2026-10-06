type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  badgeCount?: number;
};

const isMissingPushTable = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    (message.includes('does not exist') && message.includes('company_push_subscriptions'))
  );
};

const getVapidConfig = () => {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject =
    String(process.env.VAPID_SUBJECT || '').trim() || 'mailto:webdesignodobasic@gmail.com';
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
};

const sendCompanyPush = async (
  supabase: any,
  companySlug: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> => {
  const vapid = getVapidConfig();
  if (!vapid.configured || !companySlug) {
    return { sent: 0, failed: 0 };
  }

  const { data, error } = await supabase
    .from('company_push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('company_slug', companySlug);

  if (error) {
    if (!isMissingPushTable(error)) {
      console.error('push subscriptions could not be loaded', error);
    }
    return { sent: 0, failed: 0 };
  }
  if (!data?.length) {
    return { sent: 0, failed: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const webPush = require('web-push');
  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  let sent = 0;
  let failed = 0;
  await Promise.all(
    data.map(async (row: any) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (pushError: any) {
        failed += 1;
        const statusCode = Number(pushError?.statusCode || pushError?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('company_push_subscriptions').delete().eq('id', row.id);
          return;
        }
        console.error('push notification failed', {
          companySlug,
          statusCode,
          message: String(pushError?.message || 'Unbekannter Push-Fehler').slice(0, 180),
        });
      }
    }),
  );

  return { sent, failed };
};

module.exports = { getVapidConfig, sendCompanyPush };

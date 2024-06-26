import type { LoaderFunctionArgs } from '@remix-run/router';
import vCardsJS from 'vcards-js';

// noinspection JSUnusedGlobalSymbols
export async function loader({ params }: LoaderFunctionArgs) {
  const vCard = vCardsJS();

  const { name, phone } = params;
  const nameParts = name?.split(' ') ?? [];

  //set properties
  vCard.firstName = nameParts[0];
  if (nameParts.length > 2) {
    vCard.middleName = nameParts[1];
    vCard.lastName = nameParts.slice(2).join(' ');
  } else {
    vCard.lastName = nameParts[1];
  }

  vCard.cellPhone = phone ?? '';

  return new Response(vCard.getFormattedString(), {
    status: 200,
    headers: {
      'Content-Type': `text/vcard; name="contact-${phone}.vcf"`,
      'Content-Disposition': `inline; filename="contact-${phone}.vcf"`,
    },
  });
}

import fs from "fs";
import dDanfe from "d-danfe";

const xml = `
<nfeProc>
  <NFe>
    <infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">
      <ide>
        <mod>55</mod>
        <dhEmi>2026-04-28T09:16:34-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>00000000000000</CNPJ>
        <xNome>Nome Emissor</xNome>
      </emit>
      <dest>
        <CNPJ>11111111111111</CNPJ>
        <xNome>Nome Destinatario</xNome>
      </dest>
      <total>
        <ICMSTot>
          <vNF>100.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>
`;

try {
  let html = dDanfe(xml);
  console.log(html.substring(0, 100)); // Print start of HTML
} catch(e) {
  console.error(e);
}

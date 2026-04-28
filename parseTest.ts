import { XMLParser } from "fast-xml-parser";

const xmlData = `
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
  <protNFe>
    <infProt>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>
`;

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
});

const jsonObj = parser.parse(xmlData);
const obj = jsonObj.nfeProc || jsonObj.NFe;

console.log(JSON.stringify(jsonObj, null, 2));


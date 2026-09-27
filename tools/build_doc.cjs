// Generate the review document from a single editable content source.
// Install docx locally or provide its path via DOCX_MODULE.
const fs = require('fs');
const path = require('path');
const d = require(process.env.DOCX_MODULE || 'docx');
const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ShadingType,
       Header,Footer,PageNumber,AlignmentType,HeadingLevel,ExternalHyperlink,ImageRun,LevelFormat}=d;
const root=path.resolve(__dirname,'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'方案内容.json'),'utf8'));
const ink='18352E',green='265847',muted='65796D',line='DCE4DA';
const run=(text,opts={})=>new TextRun({text,font:'Microsoft YaHei',size:21,...opts});
const p=(text,opts={})=>new Paragraph({children:[run(text)],spacing:{after:110,line:320},...opts});
const head=(text)=>new Paragraph({heading:HeadingLevel.HEADING_2,children:[run(text,{bold:true,color:green,size:24})],spacing:{before:190,after:95},keepNext:true});
const widths=[1700,5350,2256];
function table(t){return new Table({width:{size:9306,type:WidthType.DXA},columnWidths:widths,rows:[t.headers,...t.rows].map((row,i)=>new TableRow({tableHeader:i===0,cantSplit:true,children:row.map((cell,j)=>new TableCell({width:{size:widths[j],type:WidthType.DXA},margins:{top:105,bottom:105,left:115,right:115},shading:{fill:i===0?ink:i%2===0?'F2F5EF':'FFFFFF',type:ShadingType.CLEAR},borders:Object.fromEntries(['top','bottom','left','right'].map(k=>[k,{style:'single',size:1,color:line}])),children:[new Paragraph({children:[run(cell,{size:19,color:i===0?'FFFFFF':ink,bold:i===0})],spacing:{after:0,line:275}})]}))}))});}
const sections=content.pages.map((page,i)=>{
 const children=[];
 if(i===0){children.push(p('GUANLAN / PROJECT PROPOSAL',{spacing:{after:150}}));children.push(new Paragraph({children:[run(content.title,{font:'SimSun',size:64,color:ink})],spacing:{after:120}}));children.push(p(content.subtitle,{spacing:{after:110}}));children.push(p(content.date,{spacing:{after:260}}));}
 children.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[run(page.title,{size:32,bold:true,color:ink})],spacing:{after:150},keepNext:true}));
 children.push(p(page.lead,{border:{left:{style:'single',color:'B9CDB8',size:18,space:10}},spacing:{after:180,line:330}}));
 if(page.table)children.push(table(page.table));
 if(page.screenshots){const file=path.join(root,'assets','overview.png');if(fs.existsSync(file)){children.push(new Paragraph({children:[new ImageRun({type:'png',data:fs.readFileSync(file),transformation:{width:575,height:359},altText:{title:'观澜原型经营总览',description:'合成客户总览、预置客群分布与数据到策略流程。',name:'overview'}})],spacing:{after:90}}));children.push(p('图 1  交互原型经营总览；所有数字来自合成样例，客群为预置演示标签。',{spacing:{after:150}}));}}
 for(const s of page.sections){children.push(head(s.heading));for(const txt of s.paragraphs||[])children.push(p(txt));for(const txt of s.bullets||[])children.push(p(txt,{numbering:{reference:'bullets',level:0},spacing:{after:75,line:300}}));for(const ref of s.references||[]){children.push(p(ref.label,{spacing:{after:60,line:280}}));if(ref.url)children.push(new Paragraph({children:[new ExternalHyperlink({link:ref.url,children:[run(ref.url,{size:17,color:green,underline:{}})]})],spacing:{after:100,line:230}}));}}
 return {properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1300,right:1300}},type:i===0?undefined:'nextPage'},headers:{default:new Header({children:[new Paragraph({children:[run('观澜  /  零售客户智能画像与精准服务',{size:17,color:muted})],border:{bottom:{style:'single',color:line,size:5,space:8}},spacing:{after:150}})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[run('导师评审稿  ·  合成数据与拟实现方案    ',{size:16,color:muted}),new TextRun({children:[PageNumber.CURRENT],size:16,color:muted})]})]})},children};
});
const doc=new Document({creator:'项目组',title:content.subtitle,description:'导师评审方案；当前为合成数据交互原型。',styles:{default:{document:{run:{font:'Microsoft YaHei',size:21,color:ink}}},paragraphStyles:[{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,paragraph:{outlineLevel:0}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,paragraph:{outlineLevel:1}}]},numbering:{config:[{reference:'bullets',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:300,hanging:180}}}}]}]},sections});
Packer.toBuffer(doc).then(buffer=>{fs.writeFileSync(path.join(root,'观澜_导师评审方案.docx'),buffer);console.log('Word generated:',buffer.length,'bytes')});
const md=[`# ${content.title}｜${content.subtitle}`,content.date,''];
for(const page of content.pages){md.push(`## ${page.title}`,'',page.lead,'');if(page.table){md.push('| '+page.table.headers.join(' | ')+' |','| '+page.table.headers.map(()=>'---').join(' | ')+' |',...page.table.rows.map(row=>'| '+row.join(' | ')+' |'),'');}for(const s of page.sections){md.push(`### ${s.heading}`,'',...(s.paragraphs||[]).flatMap(x=>[x,'']),...(s.bullets||[]).map(x=>'- '+x),'');for(const ref of s.references||[])md.push(ref.url?`- [${ref.label}](${ref.url})`:`- ${ref.label}`);md.push('');}}
fs.writeFileSync(path.join(root,'方案文字版.md'),md.join('\n'));

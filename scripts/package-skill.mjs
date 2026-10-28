import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
// Portable ZIP packaging without an installation-time dependency or shell helper.
const crc32=buffer=>{let crc=0xffffffff;for(const b of buffer){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;};
const files=['SKILL.md','agents/openai.yaml','scripts/rogue.mjs','THIRD_PARTY_NOTICES.md','LICENSE'],local=[],central=[];let offset=0;
for(const file of files){
  const name=Buffer.from('rogue-launch/'+file),data=readFileSync('skills/rogue-launch/'+file),compressed=deflateRawSync(data),crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);
  local.push(h,name,compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+compressed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const archive=Buffer.concat([...local,directory,end]);mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/rogue-launch.zip',archive);writeFileSync('artifacts/rogue-launch.sha256',createHash('sha256').update(archive).digest('hex')+'  rogue-launch.zip\n');console.log('Installable ROGUE Skill archive packaged.');

/**
 * 乡土三馆的「门面图」选片表 —— 首页卡片与专题馆卡片共用同一份。
 *
 * 为什么要单独一个文件：这两处曾各自维护一份 COVER 常量，改了一处忘了另一处，
 * 于是首页还挂着太姥山云海的老图、专题馆已经换成新拼贴，同一个人在站内看到两个版本。
 * 现在两处都从这张表取图，改图只改一次。
 *
 * 选片的两条硬约束：
 * 1) 不能有媒体水印。太姥山、三都澳、九龙漈、畲族双音、瑞云歌会、畲族婚俗的原图右下角
 *    带「闽东日报」「东南网」等半透明印记，做成整幅一眼就看见，所以这些图不能当门面。
 * 2) 四格拼贴时每格会被压到 90~190px 宽，必须挑有明确主体的图（人、桥、鱼群），
 *    云海、渔排这类大面积纹理在窄格里会糊成色块。
 *
 * mindong 的顺序有含义：第 0 张是主图（占大半幅），后三张是右侧/角标索引，
 * 依次对应「曲艺—技艺—民俗」，与馆内五类主题的视觉线索对得上。
 */
export const LOCAL_COVER_IDS = {
  papercut: ['PC-001', 'PC-030', 'PC-090', 'PC-180'],
  she: ['SHE-CLOTH-01', 'SHE-FESTIVAL-01', 'SHE-CRAFT-01', 'SHE-RIBBON-01'],
  mindong: ['M-SCENIC-005', 'M-OPERA-006', 'M-CRAFT-001', 'M-FEST-004']
}

/** 取某馆的门面条目（按 id 从全量条目里查，缺图或缺条目的自动跳过） */
export function pickCoverEntries(collectionId, entries) {
  return (LOCAL_COVER_IDS[collectionId] || [])
    .map((id) => entries.find((e) => e.id === id))
    .filter((e) => e && e.media && e.media[0] && e.media[0].src)
}

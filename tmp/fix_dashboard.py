import os

path = './src/pages/Dashboard.tsx'
content = open(path, 'r').read()

# 1. Replace the attendant table
old_table_start = content.find('<table className="w-full text-left border-collapse">')
if old_table_start != -1:
    old_table_end = content.find('</table>', old_table_start)
    if old_table_end != -1:
        old_table_block = content[old_table_start : old_table_end + len('</table>')]
        new_responsive_block = """{/* Desktop view: table */}
                  <div className="hidden md:block overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-medium">Produto</th>
                          <th className="px-6 py-4 font-medium">Setor</th>
                          <th className="px-6 py-4 font-medium">Estoque Sist.</th>
                          <th className="px-6 py-4 font-medium text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredMaterials.map(mat => (
                          <tr key={mat.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-foreground flex items-center gap-2">{mat.name}{mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse">Novo</span>)}</div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">{mat.code}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{mat.sector}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium mb-1">{mat.quantity} {formatUnit(mat.unit)}</div>
                              <StatusBadge status={mat.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                               <button 
                                 onClick={() => setImageModalMaterial(mat)}
                                 className="text-amber-500 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-colors inline-flex items-center gap-1.5"
                                 title="Visualizar Foto Ilustrativa"
                               >
                                 <Eye className="w-4 h-4" />
                                 <span className="sr-only sm:not-sr-only text-xs">Ver</span>
                               </button>
                               <button 
                                 onClick={() => {
                                   setActiveMaterial(mat);
                                   setCountQuantity(mat.quantity);
                                   setCountNotes('');
                                   setCountStatus('AWAITING_CONFIRMATION');
                                   setShowCountModal(true);
                                 }}
                                 className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                               >
                                 <Edit3 className="w-4 h-4" /> Contar
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile/Tablet view: Cards */}
                  <div className="md:hidden divide-y divide-border">
                    {filteredMaterials.map(mat => (
                      <div key={mat.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="truncate">{mat.name}</span>
                              {mat.repostedAt && (new Date().getTime() - new Date(mat.repostedAt).getTime() < 24 * 60 * 60 * 1000) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">Novo</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-mono mt-0.5 block">{mat.code}</span>
                          </div>
                          <button 
                             onClick={() => setImageModalMaterial(mat)}
                             className="text-amber-500 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                             title="Visualizar Foto Ilustrativa"
                          >
                             <Eye className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">Setor:</span> {mat.sector}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-foreground text-sm">{mat.quantity} {formatUnit(mat.unit)}</div>
                            <div className="mt-1"><StatusBadge status={mat.status} /></div>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setActiveMaterial(mat);
                            setCountQuantity(mat.quantity);
                            setCountNotes('');
                            setCountStatus('AWAITING_CONFIRMATION');
                            setShowCountModal(true);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10"
                        >
                          <Edit3 className="w-4 h-4" /> Registrar Contagem
                        </button>
                      </div>
                    ))}
                  </div>"""
        content = content.replace(old_table_block, new_responsive_block)
        print("TABLE_SUCCESS")
    else:
        print("TABLE_END_NOT_FOUND")
else:
    print("TABLE_START_NOT_FOUND")

reposted_title = "Produtos Recém Repostos / Entregues"
title_pos = content.find(reposted_title)
if title_pos != -1:
    map_pos = content.find('.map(mat => (', title_pos)
    if map_pos != -1:
        div_start = content.find('<div key={mat.id}', map_pos)
        if div_start != -1:
            reposto_time_pos = content.find('Reposto em:', div_start)
            if reposto_time_pos != -1:
                outer_div_end_pos = content.find('</div>', reposto_time_pos)
                if outer_div_end_pos != -1:
                    block_to_replace = content[div_start : outer_div_end_pos + len('</div>')]
                    new_block_repostos = """<div key={mat.id} className="p-4 px-6 hover:bg-secondary/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-foreground text-sm truncate">{mat.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded shrink-0">{mat.code}</span>
                        <button 
                           onClick={() => setImageModalMaterial(mat)}
                           className="text-amber-500 hover:text-amber-400 p-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                           title="Visualizar Foto"
                        >
                           <Eye className="w-4 h-4" />
                        </button>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0 animate-pulse">Novo</span>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1 truncate">Última movimentação: {mat.notes || 'Estoque reabastecido recentemente.'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                     <span className="text-xs bg-secondary px-3 py-1.5 rounded-full border border-border whitespace-nowrap">Estoque Atual: <strong className="text-foreground">{mat.quantity} {formatUnit(mat.unit)}</strong></span>
                     <span className="text-xs text-muted-foreground bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 whitespace-nowrap">Reposto em: {new Date(mat.repostedAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>"""
                    content = content.replace(block_to_replace, new_block_repostos)
                    print("REPOSTOS_SUCCESS")
                else:
                    print("OUTER_DIV_END_NOT_FOUND")
            else:
                print("REPOSTO_TIME_POS_NOT_FOUND")
        else:
            print("REPOSTOS_DIV_START_NOT_FOUND")
    else:
        print("REPOSTOS_MAP_NOT_FOUND")
else:
    print("REPOSTOS_TITLE_NOT_FOUND")

open(path, 'w').write(content)
print("ALL_DONE")

/* Reporte de calificaciones descargable, generado en el navegador. */
window.IFOBEGradesPDF = async function ({course, user, breakdown, score, isExam, validGrade}) {
  if (!window.jspdf?.jsPDF) throw Error('No se pudo cargar el generador de PDF. Actualiza la página.');
  const pdf = new window.jspdf.jsPDF({unit:'mm', format:'a4'});
  const navy = '#142d4e', gold = '#b78a37';
  const date = new Date().toLocaleString('es-CO');
  let logo;
  try {
    logo = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = reject;
      img.src = window.IFOBE_CONFIG?.imagenes?.logo || 'img/Logogen10.png';
    });
  } catch (_) { /* El nombre institucional se conserva si la imagen no carga. */ }
  let y;
  function header() {
    pdf.setFillColor(navy); pdf.rect(0,0,210,43,'F');
    if (logo) {
      pdf.setFillColor('#ffffff'); pdf.roundedRect(16,8,27,27,3,3,'F');
      const scale = Math.min(23/logo.width,23/logo.height);
      pdf.addImage(logo,16+(27-logo.width*scale)/2,8+(27-logo.height*scale)/2,logo.width*scale,logo.height*scale);
    }
    pdf.setTextColor('#ffffff'); pdf.setFont('times','bold'); pdf.setFontSize(22);
    pdf.text('INSTITUTO IFOBE',logo?50:16,20);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(10);
    pdf.text('GEN10  |  REPORTE DE CALIFICACIONES',logo?50:16,29);
    pdf.setFillColor(gold); pdf.rect(0,43,210,1.5,'F'); y=55;
  }
  function nextPage() { pdf.addPage(); header(); }
  function line(text, size=10, bold=false, color=navy) {
    pdf.setFont('helvetica',bold?'bold':'normal'); pdf.setFontSize(size); pdf.setTextColor(color);
    const lines=pdf.splitTextToSize(String(text ?? '').replace(/[\r\n]+/g,' '),178);
    const height=size*0.48;
    for (const value of lines) {
      if(y+height>271) { nextPage(); pdf.setFont('helvetica',bold?'bold':'normal'); pdf.setFontSize(size); pdf.setTextColor(color); }
      pdf.text(value,16,y); y+=height;
    }
    y+=2;
  }
  header();
  line(course.titulo,17,true);
  line('Estudiante: '+user.nombre,11,true);
  line('Correo: '+user.email);
  line('Estado del curso: '+course.estado+'   |   Descarga: '+date,9);
  y+=3;
  line('RESUMEN ACADÉMICO',11,true,gold);
  line('Ponderación: tareas '+(breakdown.configured?course.pesoTareas+'%':'Pendiente')+' · exámenes '+(breakdown.configured?(100-course.pesoTareas)+'%':'Pendiente'));
  line('Promedio de tareas: '+score(breakdown.tasks.average)+'   |   Promedio de exámenes: '+score(breakdown.exams.average));
  line('NOTA FINAL: '+score(breakdown.final)+' / 5.0',14,true);
  y+=4;
  line('DETALLE DE EVALUACIONES',11,true,gold);
  if(!breakdown.rows.length) line('No hay evaluaciones registradas.');
  breakdown.rows.forEach(({task,submission}, index) => {
    if(y+25>271) nextPage();
    pdf.setDrawColor('#dce3eb'); pdf.line(16,y,194,y); y+=6;
    line((index+1)+'. '+task.titulo,11,true);
    const graded=validGrade(submission);
    line((isExam(task)?'Examen':'Tarea')+'   |   Nota: '+(graded?score(submission.nota)+' / 5.0':'Pendiente'));
    if(submission?.comentario) line('Comentario del docente: '+submission.comentario,9,false,'#52647a');
    y+=3;
  });
  y+=3;
  line('Las notas pendientes no equivalen a cero. Este reporte refleja las calificaciones al momento de la descarga y no constituye un certificado.',9,false,'#52647a');
  const pages=pdf.getNumberOfPages();
  for(let page=1;page<=pages;page++) {
    pdf.setPage(page); pdf.setDrawColor(gold); pdf.line(16,279,194,279);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor('#637185');
    pdf.text('Instituto IFOBE · Gestión académica',16,285);
    pdf.text('Página '+page+' de '+pages,194,285,{align:'right'});
  }
  pdf.save('Calificaciones-'+String(course.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf');
};

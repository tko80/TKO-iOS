import SwiftUI
struct SignaturePad: View {
    @Binding var strokes: [Stroke]
    @State private var current: [CGPoint] = []
    struct Stroke: Codable, Identifiable { var id=UUID(); var points:[Point] }
    struct Point: Codable { var x:Double; var y:Double; var cg:CGPoint { CGPoint(x:x,y:y) } }
    var body: some View {
        GeometryReader { geo in
            ZStack {
                RoundedRectangle(cornerRadius:18).fill(Color.white)
                Canvas { context, size in
                    for stroke in strokes {
                        draw(stroke.points.map(\.cg), in:&context)
                    }
                    draw(current, in:&context)
                }
                VStack { Spacer(); Rectangle().fill(Color.gray.opacity(0.22)).frame(height:1).padding(.horizontal,18) }
                VStack { HStack { Text("RECEIVER SIGNATURE").font(.system(size:10,weight:.bold)).tracking(1.5).foregroundStyle(.gray); Spacer() }; Spacer() }.padding(13)
            }
            .overlay(RoundedRectangle(cornerRadius:18).stroke(Color.blue.opacity(0.22),style:StrokeStyle(lineWidth:1.2,dash:[5,4])))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance:0)
                .onChanged { v in current.append(v.location) }
                .onEnded { _ in
                    let pts=current.map { Point(x:$0.x,y:$0.y) }
                    if let first=pts.first { strokes.append(Stroke(points: pts.count == 1 ? [first,first] : pts)) }
                    current=[]
                })
        }.frame(height:190)
    }
    private func draw(_ points:[CGPoint],in context:inout GraphicsContext) {
        guard let first=points.first else{return}
        var path=Path();path.move(to:first)
        if points.count==1 { path.addLine(to:CGPoint(x:first.x+0.1,y:first.y+0.1)) }
        else { for p in points.dropFirst(){path.addLine(to:p)} }
        context.stroke(path,with:.color(Color(red:0.08,green:0.18,blue:0.38)),style:StrokeStyle(lineWidth:2.6,lineCap:.round,lineJoin:.round))
    }
    func encodedImage(size:CGSize)->Data? { nil }
}